import { NextRequest, NextResponse } from "next/server";
import { jobStore, jobToPublic } from "@/lib/server/jobs";

export const runtime = "nodejs";

/** Status batch untuk banyak job sekaligus: /api/jobs?ids=a,b,c */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);
  const jobs = ids.map((id) => {
    const j = jobStore.get(id);
    return j ? jobToPublic(j) : null;
  });
  return NextResponse.json({ jobs });
}
