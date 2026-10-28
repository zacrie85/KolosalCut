import { NextRequest, NextResponse } from "next/server";
import { jobStore, jobToPublic } from "@/lib/server/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const job = jobStore.get(id);
  if (!job) {
    return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(jobToPublic(job));
}
