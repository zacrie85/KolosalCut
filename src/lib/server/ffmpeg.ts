import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import {
  Settings,
  TextElement,
  getPreset,
  labelTextFor,
  labelWordFor,
  computeSegments,
  sanitizeFile,
  BAR_H,
  QualityKey,
} from "@/lib/video-config";
import { Job, VideoInfo } from "@/lib/server/jobs";

export const UPLOADS_DIR = "/home/z/my-project/uploads";
export const EXPORTS_DIR = "/home/z/my-project/exports";
const FONT = "/usr/share/fonts/truetype/english/Carlito-Bold.ttf";

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
    const proc = spawn("ffprobe", [
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
    const proc = spawn("ffmpeg", full);
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
function lookFilters(s: Settings): string {
  const p = getPreset(s.preset);
  const f: string[] = [];
  if (p.ff) f.push(p.ff);
  if (p.vignette) f.push("vignette");
  if (p.grain > 0) f.push(`noise=alls=${p.grain}:allf=t+u`);
  return f.length ? "," + f.join(",") : "";
}

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
  isCover: boolean
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
    const px = Math.round(el.size);
    const bw = Math.max(2, Math.round(px * 0.055));
    const ls = Math.round(px * 0.32);
    let opts = `drawtext=fontfile=${FONT}:textfile=${file}:fontsize=${px}:line_spacing=${ls}`;
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
  add(s.title, "title");
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
  onProgress: (frac: number) => void
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

  const g: string[] = [];
  const look = lookFilters(s);
  const bars = barsFilter(s);
  const texts = textFilters(s, partNum, tmpDir, false);
  const textsC = coverOn ? textFilters(s, partNum, tmpDir, true) : "";

  // ---- cabang video utama ----
  if (s.ratio === "full") {
    const WZ = even(1080 * s.zoom);
    const HZ = even(1920 * s.zoom);
    g.push(
      `[0:v]scale=${WZ}:${HZ}:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=1080:1920:x=(in_w-1080)/2:y=(in_h-1920)/2,` +
        `fps=30,setsar=1${look}${bars}${texts}[pv]`
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
    g.push(`[bg][fg]overlay=(W-w)/2:(H-h)/2[ovl]`);
    g.push(`[ovl]fps=30,setsar=1${look}${bars}${texts}[pv]`);
  }

  let maps: string[];
  if (coverOn) {
    g.push(
      `[${coverInput}:v]scale=2700:4800:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=2700:4800,` +
        `zoompan=z='1+0.12*on/${NF}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${NF}:s=1080x1920:fps=30,` +
        `setsar=1${look}${bars}${textsC}[cv]`
    );
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
export async function runJob(job: Job): Promise<void> {
  const outDir = path.join(EXPORTS_DIR, job.id);
  const tmpDir = path.join(outDir, "tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    job.status = "processing";
    job.phase = "Menyiapkan...";
    job.progress = 0;

    const s = job.settings;
    const segs = computeSegments(job.info.duration, s);
    job.total = segs.length;
    const word = labelWordFor(s);
    const q = s.quality;

    // tulis file teks persis sesuai pola yang dirujuk textFilters:
    // txt_{title|label|desc}_{p|c}{n}.txt (p = bagian utama, c = cover)
    for (let i = 0; i < segs.length; i++) {
      const n = i + 1;
      const label = labelTextFor(s, n);
      if (s.title.enabled && s.title.text.trim()) {
        await writeTextFile(tmpDir, `txt_title_p${n}.txt`, s.title.text);
        await writeTextFile(tmpDir, `txt_title_c${n}.txt`, s.title.text);
      }
      if (label.trim()) {
        await writeTextFile(tmpDir, `txt_label_p${n}.txt`, label);
        await writeTextFile(tmpDir, `txt_label_c${n}.txt`, label);
      }
      if (s.desc.enabled && s.desc.text.trim()) {
        await writeTextFile(tmpDir, `txt_desc_p${n}.txt`, s.desc.text);
        await writeTextFile(tmpDir, `txt_desc_c${n}.txt`, s.desc.text);
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

      const outFile = `${sanitizeFile(job.title)}-${word}-${n}.mp4`;
      const outPath = path.join(outDir, outFile);
      await encodePart(job, seg, n, framePath, outPath, tmpDir, (frac) => {
        job.progress = (i + frac) / segs.length;
      });

      // thumbnail dari tengah cover (menampilkan tampilan akhir)
      const thumbName = `thumb_${n}.jpg`;
      const thumbTime = s.coverEnabled ? s.coverDuration * 0.6 : 0.2;
      try {
        await extractThumb(outPath, thumbTime, path.join(outDir, thumbName));
      } catch {
        try {
          if (framePath) await extractThumb(framePath, 0, path.join(outDir, thumbName));
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
      job.progress = (i + 1) / segs.length;
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
