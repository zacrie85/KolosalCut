import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";



// Direktori data (unggahan). Pada versi desktop Windows, nilai ini
// dialihkan lewat env KOLOSAL_DATA_DIR agar selalu berada di folder yang dapat ditulis.
const DATA_DIR =
  process.env.KOLOSAL_DATA_DIR || path.join(os.tmpdir(), "kolosalcut-data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const FFPROBE_BIN = process.env.FFPROBE_PATH || "ffprobe";

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** codec video asli (mis. "h264") — dipakai UI untuk saran mesin */
  codec?: string;
}
export const EXPORTS_DIR = path.join(DATA_DIR, "exports");

export async function ensureBaseDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
}

/**
 * v1.4.9 TANPA UNGGAH — bersihkan salinan upload LAMA (dipakai hanya teks
 * otomatis versi lama / mode browser). Semua folder di UPLOADS_DIR yang tidak
 * disentuh lebih dari `maxAgeMs` dibuang (termasuk folder kerja transkrip usang).
 * Aman terhadap folder yang sedang dipakai (baru saja ditulis = mtime segar).
 */
export async function purgeOldUploads(maxAgeMs = 48 * 3600_000): Promise<number> {
  let removed = 0;
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const entries = await fs.readdir(UPLOADS_DIR);
    const now = Date.now();
    for (const name of entries) {
      const dir = path.join(UPLOADS_DIR, name);
      try {
        const st = await fs.stat(dir);
        if (!st.isDirectory()) continue;
        if (now - st.mtimeMs > maxAgeMs) {
          await fs.rm(dir, { recursive: true, force: true });
          removed++;
        }
      } catch {
        /* satu folder gagal — lanjut yang lain */
      }
    }
  } catch {
    /* pembersihan gagal — biarkan */
  }
  return removed;
}

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
  // v1.3.5: codec asli disimpan — syarat kelayakan MESIN KILAT (-c copy)
  const codec = typeof v.codec_name === "string" ? v.codec_name.toLowerCase() : "";
  return { duration, width: w, height: h, hasAudio, codec };
}

