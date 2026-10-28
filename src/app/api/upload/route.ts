import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ensureBaseDirs, probeVideo, UPLOADS_DIR } from "@/lib/server/ffmpeg";
import { titleFromFilename } from "@/lib/video-config";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SIZE = 500 * 1024 * 1024; // 500MB
const OK_EXT = [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".ts", ".flv"];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Tidak ada file yang diunggah" }, { status: 400 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!OK_EXT.includes(ext) && !file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Format tidak didukung. Gunakan MP4, MOV, MKV, WebM, AVI." },
        { status: 415 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file melebihi 500MB" },
        { status: 413 }
      );
    }

    await ensureBaseDirs();
    const uploadId = randomUUID().replace(/-/g, "").slice(0, 12);
    const dir = path.join(UPLOADS_DIR, uploadId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `source${ext || ".mp4"}`);

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buf);

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
      originalName: file.name,
      title: titleFromFilename(file.name),
      size: file.size,
      duration: info.duration,
      width: info.width,
      height: info.height,
      hasAudio: info.hasAudio,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Gagal mengunggah: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
