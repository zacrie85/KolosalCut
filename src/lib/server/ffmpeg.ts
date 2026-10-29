import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  Settings,
  TextElement,
  getFrameStyle,
  getFont,
  labelTextFor,
  labelWordFor,
  computeSegments,
  sanitizeFile,
  wrapText,
  maxCharsFor,
  BAR_H,
  QualityKey,
} from "@/lib/video-config";
import { Job, VideoInfo } from "@/lib/server/jobs";
import {
  transcribeVideo,
  buildAssForPart,
  Transcript,
} from "@/lib/server/transcribe";

// Direktori data (unggahan & hasil render). Pada versi desktop Windows, nilai ini
// dialihkan lewat env KOLOSAL_DATA_DIR agar selalu berada di folder yang dapat ditulis.
const DATA_DIR =
  process.env.KOLOSAL_DATA_DIR || path.join(os.tmpdir(), "kolosalcut-data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const EXPORTS_DIR = path.join(DATA_DIR, "exports");

// Lokasi binary FFmpeg, font & overlay frame — dialihkan lewat env pada versi desktop.
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_BIN = process.env.FFPROBE_PATH || "ffprobe";
const FONTS_DIR =
  process.env.KOLOSAL_FONTS_DIR || path.join(process.cwd(), "resources", "fonts");
const OVERLAYS_DIR =
  process.env.KOLOSAL_OVERLAYS_DIR || path.join(process.cwd(), "resources", "overlays");
const FONT_FALLBACK = path.join(FONTS_DIR, "carlito.ttf");

/** Escape path agar aman dipakai di dalam filter FFmpeg (termasuk path Windows C:\...). */
function escFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

/** lokasi berkas TTF untuk kunci font */
function fontFile(fontKey: string): string {
  const f = getFont(fontKey as Parameters<typeof getFont>[0]);
  const p = path.join(FONTS_DIR, f.file);
  return p;
}

const QUALITY: Record<QualityKey, { preset: string; crf: number }> = {
  fast: { preset: "ultrafast", crf: 26 },
  balanced: { preset: "veryfast", crf: 23 },
  high: { preset: "medium", crf: 20 },
};

export async function ensureBaseDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

// ============================================================
// Probe video
// ============================================================
export async function probeVideo(p: string): Promise<VideoInfo> {
  const raw = await new Promise<string>((resolve, reject) => {
    const proc = spawn(FFPROBE_BIN, [
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      p,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.on("close", () => resolve(out));
    proc.on("error", reject);
  });
  let j: {
    streams?: Array<Record<string, unknown>>;
    format?: { duration?: string };
  } = {};
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error("Gagal membaca info video (ffprobe)");
  }
  const streams = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const hasAudio = streams.some((s) => s.codec_type === "audio");
  if (!v) throw new Error("File tidak berisi stream video yang valid");
  let w = Number(v.width ?? 0);
  let h = Number(v.height ?? 0);
  const side = (v.side_data_list as Array<{ rotation?: number }> | undefined) ?? [];
  const rot =
    side.find((d) => typeof d.rotation === "number")?.rotation ??
    Number((v.tags as Record<string, unknown> | undefined)?.rotate ?? 0);
  if (Math.abs(rot) === 90 || Math.abs(rot) === 270) [w, h] = [h, w];
  const duration = Number(j.format?.duration ?? (v.duration as string) ?? 0);
  if (!duration || !w || !h) throw new Error("Metadata video tidak lengkap");
  return { duration, width: w, height: h, hasAudio };
}

// ============================================================
// Jalankan ffmpeg dengan laporan progres
// ============================================================
async function runFfmpeg(
  args: string[],
  expectedDur: number,
  onProgress?: (frac: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const full = [...args, "-progress", "pipe:1", "-nostats"];
    try {
      // jejak argumen untuk diagnostik (tertimpa tiap panggilan)
      void fs.writeFile(path.join(os.tmpdir(), "kolosalcut-last-ffmpeg.txt"), full.join("\n"), "utf8");
    } catch {
      /* diagnostik opsional */
    }
    const proc = spawn(FFMPEG_BIN, full);
    let stderr = "";
    let lastFrac = 0;
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.stdout.on("data", (d) => {
      if (!onProgress) return;
      const lines = d.toString().split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/out_time_ms=(\d+)/);
        if (m && expectedDur > 0) {
          const frac = Math.min(0.999, Number(m[1]) / 1e6 / expectedDur);
          if (frac > lastFrac) {
            lastFrac = frac;
            onProgress(frac);
          }
        }
      }
    });
    proc.on("close", (code) => {
      if (code === 0) {
        onProgress?.(1);
        resolve();
      } else {
        reject(
          new Error(
            `ffmpeg keluar dengan kode ${code}: ${stderr.split("\n").slice(-4).join(" | ") || "tanpa detail"}`
          )
        );
      }
    });
    proc.on("error", reject);
  });
}

// ============================================================
// Penyusun filter
// ============================================================
function barsFilter(s: Settings): string {
  if (!s.bars) return "";
  const bar = BAR_H[s.barSize];
  return (
    `,drawbox=x=0:y=0:w=1080:h=${bar}:color=black@1.0:t=fill` +
    `,drawbox=x=0:y=${1920 - bar}:w=1080:h=${bar}:color=black@1.0:t=fill`
  );
}

function textFilters(
  s: Settings,
  partNum: number,
  tmpDir: string,
  isCover: boolean,
  jobTitle: string
): string {
  const parts: string[] = [];
  const add = (
    el: TextElement,
    style: "title" | "label" | "desc",
    overrideText?: string
  ) => {
    if (!el.enabled) return;
    const text = (overrideText ?? el.text).trim();
    if (!text) return;
    const file = path.join(tmpDir, `txt_${style}_${isCover ? "c" : "p"}${partNum}.txt`);
    // ditulis sinkron oleh pemanggil sebelum ffmpeg dijalankan
    // (isi berkas sudah word-wrap konsisten dgn pratinjau — lihat runJob)
    const px = Math.round(el.size);
    const bw = Math.max(2, Math.round(px * 0.055));
    const ls = Math.round(px * 0.32);
    // text_align=C: tiap baris teks multi-baris dipusatkan di blok —
    // sama seperti pratinjau kanvas (lx = cx - lw/2 per baris)
    let opts = `drawtext=fontfile='${escFilterPath(fontFile(el.font))}':textfile='${escFilterPath(file)}':fontsize=${px}:line_spacing=${ls}:text_align=C`;
    if (style === "title") {
      opts += `:fontcolor=white:borderw=${bw}:bordercolor=black@0.85:shadowx=2:shadowy=3:shadowcolor=black@0.45`;
    } else if (style === "label") {
      opts += `:fontcolor=0xF2C14E:borderw=${bw}:bordercolor=black@0.9:shadowx=2:shadowy=3:shadowcolor=black@0.5`;
    } else {
      opts += `:fontcolor=white:box=1:boxcolor=0x000000@0.42:boxborderw=18`;
    }
    opts += `:x='clip(${el.relX.toFixed(4)}*w-text_w/2,18,w-text_w-18)'`;
    opts += `:y='clip(${el.relY.toFixed(4)}*h,18,h-text_h-18)'`;
    if (isCover) opts += `:alpha='min(1,t/0.6)'`;
    parts.push(opts);
  };
  // FALLBACK JUDUL (v1.3.2): bila teks judul kosong (mis. hasil impor yang
  // tidak mengisi teks), pakai judul job (dari nama file) agar cover tidak
  // tampil tanpa judul. Toggle "Tampilkan judul" tetap dihormati.
  add(s.title, "title", s.title.text.trim() || jobTitle.trim());
  add(s.label, "label", labelTextFor(s, partNum));
  add(s.desc, "desc");
  return parts.length ? "," + parts.join(",") : "";
}

async function writeTextFile(dir: string, name: string, text: string) {
  await fs.writeFile(path.join(dir, name), text, "utf8");
}

// ============================================================
// Render satu bagian final (cover + isi) dalam satu perintah
// ============================================================
async function encodePart(
  job: Job,
  seg: { start: number; dur: number },
  partNum: number,
  framePath: string | null,
  outPath: string,
  tmpDir: string,
  onProgress: (frac: number) => void,
  assPath: string | null = null
): Promise<void> {
  const s = job.settings;
  const coverOn = s.coverEnabled && !!framePath;
  const coverDur = s.coverDuration;
  const NF = Math.max(2, Math.round(coverDur * 30));
  const q = QUALITY[s.quality];

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-nostdin"];
  args.push("-ss", seg.start.toFixed(3), "-t", seg.dur.toFixed(3), "-i", job.uploadPath);

  let idx = 1;
  let coverInput = -1;
  let silCover = -1;
  let silPart = -1;
  if (coverOn) {
    args.push("-i", framePath!);
    coverInput = idx++;
  }
  if (coverOn) {
    args.push("-f", "lavfi", "-t", coverDur.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo");
    silCover = idx++;
  }
  if (!job.info.hasAudio) {
    const t = coverOn ? seg.dur.toFixed(2) : seg.dur.toFixed(2);
    args.push("-f", "lavfi", "-t", t, "-i", "anullsrc=r=44100:cl=stereo");
    silPart = idx++;
  }

  // ---- input overlay frame (neon berputar / minimalis) ----
  // Dua input terpisah dengan durasi TERBATAS (-t): input loop tak terbatas yang
  // dibagi split ke cabang dengan laju konsumsi berbeda akan menumpuk memori tanpa batas.
  const style = getFrameStyle(s.frame);
  const frameOn = style.kind !== "none" && !!style.overlay;
  let ovCover = -1;
  let ovMain = -1;
  const overlaySrc = () =>
    style.kind === "anim"
      ? path.join(OVERLAYS_DIR, style.overlay!, "frame_%04d.png")
      : path.join(OVERLAYS_DIR, `${style.overlay}.png`);
  if (frameOn) {
    if (coverOn) {
      args.push(
        "-loop", "1",
        "-framerate", String(style.fps ?? 24),
        "-t", (coverDur + 1).toFixed(2),
        "-i", overlaySrc()
      );
      ovCover = idx++;
    }
    args.push(
      "-loop", "1",
      "-framerate", String(style.fps ?? 24),
      "-t", (seg.dur + 1).toFixed(2),
      "-i", overlaySrc()
    );
    ovMain = idx++;
  }

  const g: string[] = [];
  const bars = barsFilter(s);
  const texts = textFilters(s, partNum, tmpDir, false, job.title);
  const textsC = coverOn ? textFilters(s, partNum, tmpDir, true, job.title) : "";
  // v1.3.3: teks otomatis dari suara — filter subtitles (ASS) hanya pada
  // cabang ISI (bukan cover), sehingga ucapan selalu pas dgn teksnya.
  const subFilter = assPath
    ? `,subtitles=filename='${escFilterPath(assPath)}':fontsdir='${escFilterPath(FONTS_DIR)}'`
    : "";

  // ---- cabang video utama ----
  // posisi horizontal ambil gambar: 0 = kiri, 0.5 = tengah, 1 = kanan
  const panX = Math.min(1, Math.max(0, Number.isFinite(s.panX) ? s.panX : 0.5)).toFixed(4);
  if (s.ratio === "full") {
    const WZ = even(1080 * s.zoom);
    const HZ = even(1920 * s.zoom);
    g.push(
      `[0:v]scale=${WZ}:${HZ}:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=1080:1920:x=(in_w-1080)*${panX}:y=(in_h-1920)/2,` +
        `fps=30,setsar=1${bars}[pv0]`
    );
  } else {
    const WZ = even(1080 * s.zoom);
    const HZ = even(1920 * s.zoom);
    g.push(`[0:v]split=2[bgsrc][fgsrc]`);
    g.push(
      `[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=1080:1920,gblur=sigma=28,eq=brightness=-0.18:saturation=0.85[bg]`
    );
    g.push(
      `[fgsrc]scale=${WZ}:${HZ}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `crop=trunc(iw/2)*2:trunc(ih/2)*2[fg]`
    );
    g.push(`[bg][fg]overlay=(W-w)*${panX}:(H-h)/2[ovl]`);
    g.push(`[ovl]fps=30,setsar=1${bars}[pv0]`);
  }

  // ---- lapisan frame neon/minimalis lalu teks ----
  if (frameOn) {
    // shortest=1 (v1.3.2): input overlay dibuat lebih panjang 1 detik dgn -t,
    // tanpa shortest framesync memperpanjang output sampai overlay habis ->
    // frame terakhir video utama "membeku" 1 detik ekstra di tiap bagian.
    g.push(`[pv0][${ovMain}:v]overlay=0:0:shortest=1[pv1]`);
    g.push(`[pv1]null${texts}${subFilter}[pv]`);
  } else {
    g.push(`[pv0]null${texts}${subFilter}[pv]`);
  }

  let maps: string[];
  if (coverOn) {
    g.push(
      `[${coverInput}:v]scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=2160:3840,` +
        `zoompan=z='1+0.12*on/${NF}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${NF}:s=1080x1920:fps=30,` +
        `setsar=1${bars}[cv0]`
    );
    if (frameOn) {
      // shortest=1: sama seperti cabang utama — cover berhenti persis di coverDuration
      g.push(`[cv0][${ovCover}:v]overlay=0:0:shortest=1[cv1]`);
      g.push(`[cv1]null${textsC}[cv]`);
    } else {
      g.push(`[cv0]null${textsC}[cv]`);
    }
    if (job.info.hasAudio) {
      g.push(`[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[pa]`);
    } else {
      g.push(`[${silPart}:a]aformat=sample_fmts=fltp:channel_layouts=stereo[pa]`);
    }
    g.push(`[${silCover}:a]aformat=sample_fmts=fltp:channel_layouts=stereo[sa]`);
    g.push(`[cv][sa][pv][pa]concat=n=2:v=1:a=1[vout][aout]`);
    maps = ["-map", "[vout]", "-map", "[aout]"];
  } else {
    if (job.info.hasAudio) {
      g.push(`[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[pa]`);
    } else {
      g.push(`[${silPart}:a]aformat=sample_fmts=fltp:channel_layouts=stereo[pa]`);
    }
    maps = ["-map", "[pv]", "-map", "[pa]"];
  }

  args.push("-filter_complex", g.join(";"), ...maps);
  args.push(
    "-c:v", "libx264",
    "-preset", q.preset,
    "-crf", String(q.crf),
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    "-movflags", "+faststart",
    "-max_muxing_queue_size", "1024",
    outPath
  );

  const expected = (coverOn ? coverDur : 0) + seg.dur;
  await runFfmpeg(args, expected, onProgress);
}

// ============================================================
// Ekstraksi frame & thumbnail
// ============================================================
async function extractFrame(src: string, time: number, out: string): Promise<void> {
  await runFfmpeg([
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", Math.max(0, time).toFixed(3),
    "-i", src,
    "-frames:v", "1",
    "-q:v", "2",
    out,
  ], 0);
}

async function extractThumb(src: string, time: number, out: string): Promise<void> {
  await runFfmpeg([
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", Math.max(0, time).toFixed(3),
    "-i", src,
    "-frames:v", "1",
    "-vf", "scale=200:-2",
    "-q:v", "4",
    out,
  ], 0);
}

// ============================================================
// Orchestrator job
// ============================================================

/**
 * Tentukan folder output job:
 * - default : DATA_DIR/exports/<jobId> (folder bawaan aplikasi)
 * - pilihan : <folder pilihan user>/<Judul> (atau <Judul>-2, -3 bila sudah ada)
 * Thumbnail & berkas sementara tetap di folder bawaan agar pratinjau ringan.
 */
async function resolveOutDir(job: Job): Promise<string> {
  const fallback = path.join(EXPORTS_DIR, job.id);
  await fs.mkdir(fallback, { recursive: true });
  if (!job.outDir || !path.isAbsolute(job.outDir)) return fallback;
  const base = sanitizeFile(job.title) || "video";
  let candidate = path.join(job.outDir, base);
  for (let k = 2; k <= 300; k++) {
    try {
      await fs.mkdir(candidate); // tanpa recursive: gagal jika sudah ada -> coba nama berikut
      return candidate;
    } catch {
      candidate = path.join(job.outDir, `${base}-${k}`);
    }
  }
  // darurat: nama unik berbasis waktu
  candidate = path.join(job.outDir, `${base}-${Date.now()}`);
  await fs.mkdir(candidate, { recursive: true });
  return candidate;
}

export async function runJob(job: Job): Promise<void> {
  const thumbDir = path.join(EXPORTS_DIR, job.id);
  const tmpDir = path.join(thumbDir, "tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    job.status = "processing";
    job.phase = "Menyiapkan...";
    job.progress = 0;

    // folder hasil final (folder pilihan user bila diatur)
    job.phase = "Menyiapkan folder hasil...";
    const outDir = await resolveOutDir(job);
    job.outDir = outDir;

    const s = job.settings;
    const segs = computeSegments(job.info.duration, s);
    job.total = segs.length;
    const word = labelWordFor(s);
    const q = s.quality;

    // v1.3.3 — TEKS OTOMATIS (suara → teks, Whisper offline, Bahasa Indonesia):
    // baca suara SEKALI di video asli, lalu tiap bagian mengambil teks sesuai
    // rentang waktunya. Porsi progres tahap ini: 0..15%.
    const sub = s.subtitle;
    let transcript: Transcript | null = null;
    if (sub.enabled && job.info.hasAudio) {
      job.phase = "Membaca suara (teks otomatis)...";
      try {
        transcript = await transcribeVideo(
          job.uploadPath,
          sub.mode,
          path.dirname(job.uploadPath),
          job.info.duration,
          (f) => {
            job.progress = f * 0.15;
          }
        );
      } catch (e) {
        // gagal membaca suara = gagal job (pesan jelas), bukan senyap —
        // pengguna sengaja mengaktifkan teks otomatis.
        throw new Error(
          `Teks otomatis gagal: ${(e as Error)?.message ?? e}`
        );
      }
    }
    // porsi progres render bagian: 15..100% bila transkripsi berjalan
    const SUB_SPAN = transcript ? 0.15 : 0;
    const progBase = SUB_SPAN;
    const progSpan = 1 - SUB_SPAN;

    // tulis file teks persis sesuai pola yang dirujuk textFilters:
    // txt_{title|label|desc}_{p|c}{n}.txt (p = bagian utama, c = cover)
    // v1.3.2: isi berkas di-word-wrap seperti pratinjau (wrapText + maxCharsFor)
    // supaya render multi-barisnya identik dgn kanvas pratinjau; judul kosong
    // di-fallback ke judul job (dari nama file) agar tidak hilang di cover.
    const jobTitle = job.title.trim();
    for (let i = 0; i < segs.length; i++) {
      const n = i + 1;
      const label = labelTextFor(s, n);
      const titleText = s.title.enabled ? s.title.text.trim() || jobTitle : "";
      if (titleText) {
        const wrapped = wrapText(titleText, maxCharsFor(s.title.size)).join("\n");
        await writeTextFile(tmpDir, `txt_title_p${n}.txt`, wrapped);
        await writeTextFile(tmpDir, `txt_title_c${n}.txt`, wrapped);
      }
      if (label.trim()) {
        const wl = wrapText(label, maxCharsFor(s.label.size)).join("\n");
        await writeTextFile(tmpDir, `txt_label_p${n}.txt`, wl);
        await writeTextFile(tmpDir, `txt_label_c${n}.txt`, wl);
      }
      if (s.desc.enabled && s.desc.text.trim()) {
        const wd = wrapText(s.desc.text.trim(), maxCharsFor(s.desc.size)).join("\n");
        await writeTextFile(tmpDir, `txt_desc_p${n}.txt`, wd);
        await writeTextFile(tmpDir, `txt_desc_c${n}.txt`, wd);
      }
    }

    let sharedFrame: string | null = null;
    if (s.coverEnabled && s.coverSame) {
      const t = Math.min(1, job.info.duration * 0.08);
      sharedFrame = path.join(tmpDir, "frame_same.png");
      job.phase = "Mengambil frame cover bersama...";
      await extractFrame(job.uploadPath, t, sharedFrame);
    }

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const n = i + 1;
      job.phase = `Bagian ${n}/${segs.length}: merender`;

      let framePath: string | null = null;
      if (s.coverEnabled) {
        if (s.coverSame && sharedFrame) {
          framePath = sharedFrame;
        } else {
          const frac = s.coverPos === "tengah" ? 0.5 : 0.12;
          const t = seg.start + seg.dur * frac;
          framePath = path.join(tmpDir, `frame_${n}.png`);
          await extractFrame(job.uploadPath, t, framePath);
        }
      }

      // v1.3.3: berkas .ass teks otomatis utk bagian ini (waktu digeser)
      let assPath: string | null = null;
      if (transcript && transcript.segs.length > 0) {
        assPath = path.join(tmpDir, `sub_p${n}.ass`);
        await buildAssForPart(
          transcript,
          seg.start,
          seg.start + seg.dur,
          sub.style,
          assPath
        );
      }

      const outFile = `${sanitizeFile(job.title)}-${word}-${n}.mp4`;
      const outPath = path.join(outDir, outFile);
      await encodePart(
        job,
        seg,
        n,
        framePath,
        outPath,
        tmpDir,
        (frac) => {
          job.progress = progBase + progSpan * ((i + frac) / segs.length);
        },
        assPath
      );

      // thumbnail dari tengah cover (menampilkan tampilan akhir)
      const thumbName = `thumb_${n}.jpg`;
      const thumbTime = s.coverEnabled ? s.coverDuration * 0.6 : 0.2;
      try {
        await extractThumb(outPath, thumbTime, path.join(thumbDir, thumbName));
      } catch {
        try {
          if (framePath) await extractThumb(framePath, 0, path.join(thumbDir, thumbName));
        } catch {
          /* thumbnail opsional */
        }
      }

      const st = await fs.stat(outPath);
      job.parts.push({
        file: outFile,
        thumb: thumbName,
        size: st.size,
        duration: (s.coverEnabled ? s.coverDuration : 0) + seg.dur,
      });
      job.progress = progBase + progSpan * ((i + 1) / segs.length);
      void q;
    }

    job.status = "done";
    job.phase = "Selesai";
    job.progress = 1;
  } catch (e) {
    job.status = "error";
    job.phase = "Gagal";
    job.error = String((e as Error)?.message ?? e).slice(0, 600);
  }
}
