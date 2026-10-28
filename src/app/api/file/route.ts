import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { EXPORTS_DIR } from "@/lib/server/ffmpeg";
import { jobStore } from "@/lib/server/jobs";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get("job") ?? "";
  const name = req.nextUrl.searchParams.get("name") ?? "";

  // sanitasi ketat: hanya karakter aman, tanpa path traversal
  if (!/^[a-zA-Z0-9._-]+$/.test(job) || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  // v1.2.0: video hasil dapat berada di folder pilihan pengguna (job.outDir),
  // sedangkan thumbnail tetap di folder bawaan aplikasi.
  let filePath: string | null = null;
  const rec = jobStore.get(job);
  if (rec) {
    const part = rec.parts.find((p) => p.file === name || p.thumb === name);
    if (part) {
      const baseDir =
        name === part.file && rec.outDir ? rec.outDir : path.join(EXPORTS_DIR, rec.id);
      filePath = path.join(baseDir, name);
    }
  }
  if (!filePath) {
    const fallback = path.join(EXPORTS_DIR, job, name);
    if (!fallback.startsWith(path.join(EXPORTS_DIR, job))) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
    filePath = fallback;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  const ext = path.extname(name).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const stream = createReadStream(filePath);
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(stat.size),
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${name}"`,
  };
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}
