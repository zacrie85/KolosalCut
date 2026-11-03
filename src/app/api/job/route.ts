import { NextRequest, NextResponse } from "next/server";
import { jobStore, jobToPublic } from "@/lib/server/jobs";
import { cancelJob } from "@/lib/server/ffmpeg";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const job = jobStore.get(id);
  if (!job) {
    return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(jobToPublic(job));
}

/**
 * v1.3.5 — BATALKAN render (ala menu EKSPORT & SPLIT NOVACUT):
 * tandai job dibatalkan + bunuh semua proses ffmpeg miliknya.
 * Bagian yang sudah selesai tetap tersimpan.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const ok = cancelJob(id);
  if (!ok) {
    const job = jobStore.get(id);
    if (!job) return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ok: false, reason: "Job sudah selesai/gagal/dibatalkan" });
  }
  return NextResponse.json({ ok: true });
}
