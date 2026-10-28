import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import { ensureBaseDirs, probeVideo, UPLOADS_DIR } from "@/lib/server/ffmpeg";
import { titleFromFilename } from "@/lib/video-config";

export const runtime = "nodejs";

// v1.2.0: batas dinaikkan dari 500MB menjadi 10GB.
// File di-STREAM langsung ke disk (tidak pernah dimuat utuh ke memori) sehingga
// video 4–10 GB pun aman diproses pada PC dengan RAM biasa.
export const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const OK_EXT = [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".ts", ".flv"];

function decodeName(raw: string | null): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function POST(req: NextRequest) {
  let dir: string | null = null;
  try {
    // ---- validasi awal (sebelum byte dihiraukan) ----
    const originalName = (decodeName(req.headers.get("x-file-name")) || "video.mp4").slice(0, 300);
    const ext = path.extname(originalName).toLowerCase();
    const ctype = req.headers.get("content-type") || "";
    if (!OK_EXT.includes(ext) && !ctype.startsWith("video/")) {
      return NextResponse.json(
        { error: "Format tidak didukung. Gunakan MP4, MOV, MKV, WebM, AVI." },
        { status: 415 }
      );
    }
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file melebihi 10GB" },
        { status: 413 }
      );
    }
    if (!req.body) {
      return NextResponse.json({ error: "Tidak ada data video yang diterima" }, { status: 400 });
    }

    await ensureBaseDirs();
    const uploadId = randomUUID().replace(/-/g, "").slice(0, 12);
    dir = path.join(UPLOADS_DIR, uploadId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `source${ext || ".mp4"}`);

    // ---- streaming body -> disk, dengan penghitung byte anti melebihi batas ----
    let written = 0;
    let overLimit = false;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        written += chunk.length;
        if (written > MAX_SIZE) {
          overLimit = true;
          cb(new Error("SIZE_LIMIT"));
          return;
        }
        cb(null, chunk);
      },
    });

    try {
      await pipeline(
        Readable.fromWeb(req.body as unknown as NodeWebReadableStream),
        counter,
        createWriteStream(filePath)
      );
    } catch (e) {
      // bersihkan sebagian file agar disk tidak penuh sampah
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      dir = null;
      if (overLimit) {
        return NextResponse.json({ error: "Ukuran file melebihi 10GB" }, { status: 413 });
      }
      throw e;
    }

    const st = await fs.stat(filePath);
    if (st.size === 0) {
      await fs.rm(dir, { recursive: true, force: true });
      return NextResponse.json({ error: "Berkas video kosong" }, { status: 400 });
    }

    // ---- baca metadata via ffprobe ----
    let info;
    try {
      info = await probeVideo(filePath);
    } catch (e) {
      await fs.rm(dir, { recursive: true, force: true });
      return NextResponse.json(
        { error: `Video tidak dapat dibaca: ${(e as Error).message}` },
        { status: 422 }
      );
    }

    return NextResponse.json({
      uploadId,
      originalName,
      title: titleFromFilename(originalName),
      size: st.size,
      duration: info.duration,
      width: info.width,
      height: info.height,
      hasAudio: info.hasAudio,
    });
  } catch (e) {
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json(
      { error: `Gagal mengunggah: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
