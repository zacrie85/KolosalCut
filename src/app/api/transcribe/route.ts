// ============================================================
// KolosalCut v1.4.0 — API TEKS OTOMATIS (Whisper offline, ala lama)
// Mesin pengolahan video kini sepenuhnya berpindah ke mesin NOVACUT
// (WebCodecs di sisi aplikasi), tetapi pengenalan suara tetap memakai
// whisper-cli offline yang sudah terbukti — berjalan di server lokal
// aplikasi tanpa internet.
// Pola tugas: POST mulai → id tugas; GET ?task=id → status + hasil.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { UPLOADS_DIR, ensureBaseDirs, probeVideo, purgeOldUploads } from "@/lib/server/ffmpeg";
import { transcribeVideo, type Transcript } from "@/lib/server/transcribe";
import type { SubMode } from "@/lib/video-config";

export const runtime = "nodejs";

interface TranscribeTask {
  id: string;
  status: "jalan" | "done" | "error";
  progress: number;
  error?: string;
  segs?: { start: number; end: number; text: string }[];
  startedAt: number;
}

const g = globalThis as unknown as {
  __kcTranscribeTasks?: Map<string, TranscribeTask>;
};
const tasks: Map<string, TranscribeTask> = (g.__kcTranscribeTasks ??= new Map());

// buang tugas lebih tua dari 2 jam agar memori bersih
function prune() {
  const now = Date.now();
  for (const [id, t] of tasks) {
    if (now - t.startedAt > 2 * 3600_000) tasks.delete(id);
  }
}

export async function POST(req: NextRequest) {
  try {
    prune();
    // v1.4.9: salinan upload lama (dari versi sebelum TANPA UNGGAH) yang sudah
    // >48 jam tidak terpakai dibuang diam-diam — folder data tetap ramping
    void ensureBaseDirs().then(() => purgeOldUploads());
    const body = (await req.json().catch(() => ({}))) as {
      uploadId?: string;
      /** v1.4.9 TANPA UNGGAH: path video ASLI di disk (desktop via webUtils) —
       * whisper membaca langsung dari situ, NOL salinan ke folder upload */
      srcPath?: string;
      mode?: SubMode;
    };
    const mode: SubMode = (
      ["sangat-cepat", "cepat", "akurat"] as SubMode[]
    ).includes(body.mode as SubMode)
      ? (body.mode as SubMode)
      : "cepat";

    let sourceFile: string | null = null;
    let workDir = "";
    const rawSrcPath = (body.srcPath || "").trim();
    if (rawSrcPath) {
      // ---- TANPA UNGGAH: pakai berkas ASLI di disk (desktop lokal) ----
      // validasi ketat: path mutlak, ada, berkas biasa, ekstensi video
      const p = rawSrcPath.slice(0, 600);
      const okExt = [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".ts", ".flv"];
      const ext = path.extname(p).toLowerCase();
      if (!path.isAbsolute(p) || !okExt.includes(ext)) {
        return NextResponse.json({ error: "Path video tidak valid." }, { status: 400 });
      }
      try {
        const st = await fs.stat(p);
        if (!st.isFile()) throw new Error("bukan berkas");
        sourceFile = p;
        // folder kerja transkrip tetap di folder data aplikasi (kecil — teks saja)
        workDir = path.join(UPLOADS_DIR, "work", randomUUID().replace(/-/g, "").slice(0, 12), "transcribe");
      } catch {
        return NextResponse.json(
          { error: "Video sumber tidak dapat diakses dari lokasinya." },
          { status: 404 }
        );
      }
    } else {
      // ---- jalur lama: berkas salinan di folder upload ----
      const uploadId = (body.uploadId || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
      if (!uploadId) {
        return NextResponse.json({ error: "uploadId atau srcPath wajib diisi" }, { status: 400 });
      }
      const dir = path.join(UPLOADS_DIR, uploadId);
      try {
        const entries = await fs.readdir(dir);
        const src = entries.find((f) => f.startsWith("source."));
        if (src) sourceFile = path.join(dir, src);
      } catch {
        /* tidak ada */
      }
      if (!sourceFile) {
        return NextResponse.json(
          { error: "Video sumber tidak ditemukan. Tambahkan ulang videonya." },
          { status: 404 }
        );
      }
      workDir = path.join(dir, "transcribe");
    }

    const info = await probeVideo(sourceFile);
    const taskId = randomUUID().replace(/-/g, "").slice(0, 12);
    const task: TranscribeTask = {
      id: taskId,
      status: "jalan",
      progress: 0,
      startedAt: Date.now(),
    };
    tasks.set(taskId, task);

    // jalankan di latar belakang — klien memantau lewat GET
    void transcribeVideo(
      sourceFile,
      mode,
      workDir,
      info.duration || 0,
      (f) => {
        task.progress = Math.min(0.99, Math.max(0, f));
      }
    )
      .then((t: Transcript) => {
        task.status = "done";
        task.progress = 1;
        task.segs = t.segs.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        }));
      })
      .catch((e: unknown) => {
        task.status = "error";
        task.error = e instanceof Error ? e.message : String(e);
      });

    return NextResponse.json({ taskId });
  } catch (e) {
    return NextResponse.json(
      { error: `Gagal memulai transkripsi: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const taskId = (req.nextUrl.searchParams.get("task") || "").slice(0, 40);
  const task = tasks.get(taskId);
  if (!task) {
    return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({
    status: task.status,
    progress: task.progress,
    error: task.error,
    segments: task.segs,
  });
}
