import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { sanitizeSettings } from "@/lib/video-config";
import { jobStore, Job } from "@/lib/server/jobs";
import { EXPORTS_DIR, runJob, UPLOADS_DIR } from "@/lib/server/ffmpeg";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uploadId, originalName, title, duration, width, height, hasAudio } = body as {
      uploadId?: string;
      originalName?: string;
      title?: string;
      duration?: number;
      width?: number;
      height?: number;
      hasAudio?: boolean;
    };

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId wajib diisi" }, { status: 400 });
    }

    // cari file sumber
    const dir = path.join(UPLOADS_DIR, uploadId);
    let sourceFile: string | null = null;
    try {
      const entries = await fs.readdir(dir);
      const src = entries.find((f) => f.startsWith("source."));
      if (src) sourceFile = path.join(dir, src);
    } catch {
      /* tidak ada */
    }
    if (!sourceFile) {
      return NextResponse.json(
        { error: "Video sumber tidak ditemukan. Silakan unggah ulang." },
        { status: 404 }
      );
    }

    // probe ulang agar akurat (client bisa memanipulasi data)
    let info;
    try {
      info = await (async () => {
        const { probeVideo } = await import("@/lib/server/ffmpeg");
        return probeVideo(sourceFile!);
      })();
    } catch {
      info = {
        duration: Number(duration) || 0,
        width: Number(width) || 1080,
        height: Number(height) || 1920,
        hasAudio: Boolean(hasAudio),
      };
      if (!info.duration) {
        return NextResponse.json({ error: "Video tidak valid" }, { status: 422 });
      }
    }

    const settings = sanitizeSettings(body.settings);
    const jobId = randomUUID().replace(/-/g, "").slice(0, 10);
    await fs.mkdir(path.join(EXPORTS_DIR, jobId), { recursive: true });

    const job: Job = {
      id: jobId,
      uploadId,
      uploadPath: sourceFile,
      originalName: originalName || "video",
      title: (title || "video").slice(0, 120),
      settings,
      info,
      status: "queued",
      phase: "Menunggu antrean...",
      progress: 0,
      total: 0,
      parts: [],
      createdAt: Date.now(),
    };
    jobStore.set(jobId, job);

    // jalankan di latar belakang tanpa menahan respons
    void runJob(job);

    return NextResponse.json({ jobId, total: job.total || undefined });
  } catch (e) {
    return NextResponse.json(
      { error: `Gagal memulai proses: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
