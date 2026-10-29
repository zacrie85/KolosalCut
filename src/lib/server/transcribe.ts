// ============================================================
// KolosalCut v1.3.3 — TEKS OTOMATIS (SUARA → TEKS)
// Mesin: whisper.cpp (whisper-cli) berjalan lokal/offline.
// Fokus Bahasa Indonesia (resmi & slang) — bahasa dikunci "id".
// Tiga mode: sangat-cepat / cepat / akurat (ukuran model berbeda).
// ============================================================

import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { SubMode, SubStyle } from "@/lib/video-config";

const FFMPEG_BIN =
  process.env.FFMPEG_PATH || "ffmpeg";
const WHISPER_BIN =
  process.env.WHISPER_PATH ||
  path.join(process.cwd(), "resources", "bin", "whisper-cli");
const WHISPER_MODELS_DIR =
  process.env.KOLOSAL_WHISPER_MODELS_DIR ||
  path.join(process.cwd(), "resources", "models");

/** peta mode → berkas model ggml (q5_1: ringkas & cepat di CPU) */
const MODEL_FILES: Record<SubMode, string> = {
  "sangat-cepat": "ggml-tiny-q5_1.bin",
  cepat: "ggml-base-q5_1.bin",
  akurat: "ggml-small-q5_1.bin",
};

// ============================================================
// Tipe hasil transkripsi
// ============================================================
export interface SubWord {
  start: number;
  end: number;
  text: string;
}
export interface SubSeg {
  start: number;
  end: number;
  text: string;
  words?: SubWord[];
}
export interface Transcript {
  language: string;
  segs: SubSeg[];
}

// ============================================================
// Jalankan binary eksternal, tangkap stderr + progres
// ============================================================
interface RunOpts {
  /** laporan progres penuh (0..1) dihitung pemanggil dari tiap baris stderr */
  onStderrLine?: (line: string) => void;
  cwd?: string;
}

async function runBin(
  bin: string,
  args: string[],
  opts: RunOpts = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      cwd: opts.cwd,
      env: {
        ...process.env,
        // Linux: library whisper (libwhisper.so, libggml*.so) bersebelahan
        // dengan binary — pastikan bisa dimuat. Di Windows tidak berefek.
        LD_LIBRARY_PATH: [
          path.dirname(bin),
          process.env.LD_LIBRARY_PATH || "",
        ]
          .filter(Boolean)
          .join(":"),
      },
    });
    let stderr = "";
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
      if (opts.onStderrLine) {
        for (const line of s.split(/\r?\n|\r/)) {
          if (line.trim()) opts.onStderrLine(line);
        }
      }
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `${path.basename(bin)} keluar kode ${code}: ${
              stderr.split("\n").slice(-3).join(" | ") || "tanpa detail"
            }`
          )
        );
    });
    proc.on("error", (e) =>
      reject(
        new Error(
          `Gagal menjalankan ${path.basename(bin)}: ${e.message}. ` +
            `Pastikan aplikasi terinstal penuh.`
        )
      )
    );
  });
}

// ============================================================
// 1) Ekstrak audio → WAV 16 kHz mono (format yang diminta whisper)
// ============================================================
async function extractAudioWav(
  videoPath: string,
  durSec: number,
  outWav: string,
  onProgress?: (frac: number) => void
): Promise<void> {
  try {
    await runBin(
      FFMPEG_BIN,
      [
        "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
        "-progress", "pipe:1", "-nostats",
        "-i", videoPath,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        outWav,
      ],
      {
        onStderrLine: onProgress
          ? (line) => {
              // ffmpeg -progress menulis out_time_ms=... di stdout (tertangkap
              // bersama stderr lewat pola time=) — pakai stderr "time=" saja.
              const m = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
              if (m && durSec > 0) {
                onProgress(Math.min(0.999, hmsToSec(m[1], m[2], m[3]) / durSec));
              }
            }
          : undefined,
      }
    );
  } catch (e) {
    throw new Error(`Ekstraksi audio gagal: ${(e as Error).message}`);
  }
}

/** parse "H:MM:SS.xx" menjadi detik */
function hmsToSec(h: string, m: string, s: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// ============================================================
// 2) Jalankan whisper-cli → JSON → Transcript
//    -l id        : kunci Bahasa Indonesia
//    -sow -ml 1   : pecah per kata → timestamp kata tersedia (karaoke)
//    -oj -of base : keluaran JSON ke <base>.json
// ============================================================
export async function transcribeVideo(
  videoPath: string,
  mode: SubMode,
  workDir: string,
  durSec: number,
  onProgress?: (frac: number) => void
): Promise<Transcript> {
  // pastikan binary & model tersedia — pesan galat jelas bila tidak
  let stat: import("fs").Stats | null = null;
  try {
    stat = await fs.stat(WHISPER_BIN);
  } catch {
    /* tidak ada */
  }
  if (!stat) {
    throw new Error(
      "Mesin teks otomatis (whisper-cli) tidak ditemukan di aplikasi. " +
        "Instal ulang KolosalCut versi lengkap."
    );
  }
  const modelFile = path.join(WHISPER_MODELS_DIR, MODEL_FILES[mode]);
  try {
    await fs.access(modelFile);
  } catch {
    throw new Error(
      `Model suara "${MODEL_FILES[mode]}" tidak ditemukan. Instal ulang KolosalCut versi lengkap.`
    );
  }

  await fs.mkdir(workDir, { recursive: true });
  const wavPath = path.join(workDir, "audio16k.wav");
  const outBase = path.join(workDir, "transcript");

  // tahap 1: ekstrak audio (cepat) — porsi progres 0..0.1
  if (onProgress) {
    await extractAudioWav(
      videoPath,
      durSec,
      wavPath,
      (f) => onProgress(f * 0.1)
    );
  } else {
    await extractAudioWav(videoPath, durSec, wavPath);
  }

  // tahap 2: whisper membaca suara — porsi progres 0.1..1
  const threads = Math.min(8, Math.max(4, Math.floor(os.cpus().length / 2)));
  const whisperArgs = [
    "-m", modelFile,
    "-f", wavPath,
    "-l", "id",
    "-sow",
    "-ml", "1",
    "-t", String(threads),
    "-pp",
    "-oj",
    "-of", outBase,
  ];
  // catatan: whisper menulis "whisper_print_progress: progress = N%" pada
  // stderr bila -pp aktif — dihitung di sini menjadi porsi 0.1..1.
  const wrap = onProgress
    ? (f: number) => onProgress(0.1 + f * 0.9)
    : undefined;
  await runBin(WHISPER_BIN, whisperArgs, {
    onStderrLine: wrap
      ? (line) => {
          const m = line.match(/progress\s*=\s*(\d+)%/);
          if (m) wrap(Math.min(0.999, Number(m[1]) / 100));
        }
      : undefined,
    cwd: workDir,
  });

  const j = JSON.parse(await fs.readFile(`${outBase}.json`, "utf8")) as {
    result?: { language?: string };
    transcription?: Array<{
      offsets?: { from?: number; to?: number };
      text?: string;
    }>;
  };
  // WAV 16 kHz bisa besar (video 2 jam ≈ 230 MB) — hapus setelah selesai dibaca
  void fs.rm(wavPath, { force: true }).catch(() => undefined);
  const raw = j.transcription ?? [];
  const words: SubWord[] = [];
  for (const t of raw) {
    const text = (t.text ?? "").trim();
    if (!text) continue;
    const start = (t.offsets?.from ?? 0) / 1000;
    const end = (t.offsets?.to ?? 0) / 1000;
    if (end <= start) continue;
    words.push({ start, end, text });
  }
  // gabung kata-kata menjadi segmen kalimat (batas: tanda baca / jeda / 8 kata)
  const segs = groupWords(words);
  return { language: j.result?.language ?? "id", segs };
}

/** gabung kata per-kata menjadi segmen caption yang enak dibaca */
function groupWords(words: SubWord[]): SubSeg[] {
  if (words.length === 0) return [];
  const segs: SubSeg[] = [];
  let cur: SubWord[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    segs.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" "),
      words: cur,
    });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const gap = i + 1 < words.length ? words[i + 1].start - w.end : 0;
    const punct = /[.!?…]$/.test(w.text);
    const comma = /,$/.test(w.text);
    if (punct || gap > 0.7 || cur.length >= 12 || (comma && cur.length >= 5)) {
      flush();
    }
  }
  flush();
  return segs;
}

// ============================================================
// 3) Bangun berkas .ass untuk satu bagian video
//    (waktu digeser: waktu master - segStart; hanya bagian tumpang tindih)
// ============================================================
function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const cs = Math.round(s * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const ss = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

function assEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")");
}

/** potong daftar kata menjadi cuplikan caption pendek (gaya TikTok/Karaoke) */
function chunkWords(words: SubWord[], maxWords: number, maxDur: number): SubWord[][] {
  const out: SubWord[][] = [];
  let cur: SubWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const gap = i + 1 < words.length ? words[i + 1].start - w.end : 0;
    const dur = cur[cur.length - 1].end - cur[0].start;
    if (cur.length >= maxWords || dur >= maxDur || gap > 0.45 || /[.!?…]$/.test(w.text)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function buildAssForPart(
  transcript: Transcript,
  segStart: number,
  segEnd: number,
  style: SubStyle,
  posY: number,
  outPath: string
): Promise<void> {
  // hanya ucapan yang jatuh di dalam rentang bagian ini (toleransi 1ms)
  const t0 = segStart - 0.001;
  const t1 = segEnd + 0.001;
  const inRange = transcript.segs.filter((sg) => sg.end > t0 && sg.start < t1);

  const lines: string[] = [];
  const push = (start: number, end: number, text: string) => {
    if (end <= start) return;
    lines.push(
      `Dialogue: 0,${assTime(start - segStart)},${assTime(end - segStart)},Utama,,0,0,0,,${text}`
    );
  };

  if (style === "klasik") {
    // gaya film: gunakan segmen kalimat apa adanya (libass membungkus otomatis)
    for (const sg of inRange) {
      const text = assEscape(sg.text);
      push(Math.max(sg.start, segStart), Math.min(sg.end, segEnd), text);
    }
  } else if (style === "tiktok") {
    // gaya TikTok: cuplikan pendek rata tengah
    const all = inRange.flatMap((sg) => sg.words ?? [sg as SubWord]);
    for (const ch of chunkWords(all, 4, 2.8)) {
      const text = assEscape(ch.map((w) => w.text).join(" "));
      push(
        Math.max(ch[0].start, segStart),
        Math.min(ch[ch.length - 1].end, segEnd),
        text
      );
    }
  } else {
    // karaoke: cuplikan pendek + tag \k per kata (menyala mengikuti suara)
    const all = inRange.flatMap((sg) => sg.words ?? [sg as SubWord]);
    for (const ch of chunkWords(all, 5, 3.5)) {
      const parts: string[] = [];
      for (const w of ch) {
        const k = Math.max(5, Math.round((w.end - w.start) * 100));
        parts.push(`{\\k${k}}${assEscape(w.text)}`);
      }
      push(
        Math.max(ch[0].start, segStart),
        Math.min(ch[ch.length - 1].end, segEnd) + 0.12,
        parts.join(" ")
      );
    }
  }

  // v1.3.4: posisi vertikal teks dikendalikan pengguna (posY 0..1, 1 = paling bawah).
  // Semua gaya kini ber-anchour bawah-tengah (Alignment 2) -> MarginV = jarak dari
  // bawah; blok banyak baris tumbuh ke atas. Batasi agar teks tidak keluar layar.
  const safePosY = Math.min(0.95, Math.max(0.05, Number.isFinite(posY) ? posY : 0.75));
  const marginV = Math.max(40, Math.min(1800, Math.round((1 - safePosY) * 1920)));

  const header = [
    "[Script Info]",
    "; KolosalCut v1.3.4 — teks otomatis dari suara (Whisper)",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // klasik: putih, garis luar hitam — posisi ikut slider pengguna (v1.3.4)
    `Style: Utama,Archivo Black,54,&H00FFFFFF,&H000000FF,&H00101010,&H96000000,0,0,0,0,100,100,0,0,1,3,1,2,70,70,${marginV},1`,
    // (gaya tiktok/karaoke memakai gaya berbeda via baris style tambahan)
    `Style: TikTok,Archivo Black,66,&H00FFFFFF,&H000000FF,&H00101010,&HA0000000,-1,0,0,0,100,100,0,0,3,10,2,2,60,60,${marginV},1`,
    // karaoke: Primary = emas (sudah terucap), Secondary = putih (belum)
    `Style: Karaok,Archivo Black,66,&H0000D7FF,&H00FFFFFF,&H00101010,&HA0000000,-1,0,0,0,100,100,0,0,3,10,2,2,60,60,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const body =
    style === "klasik"
      ? lines
      : lines.map((l) => l.replace("Utama,", style === "tiktok" ? "TikTok," : "Karaok,"));
  const content = header.join("\n") + "\n" + body.join("\n") + "\n";
  return fs.writeFile(outPath, content, "utf8");
}
