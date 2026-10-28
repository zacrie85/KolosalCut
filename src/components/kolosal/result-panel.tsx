"use client";

import { useEffect, useState } from "react";
import type { JobPublic } from "@/lib/server/jobs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Film,
  FolderOpen,
  FolderCheck,
} from "lucide-react";
import { fmtDur } from "@/lib/video-config";
import { HudCorners } from "@/components/kolosal/hud";

interface ResultPanelProps {
  job: JobPublic | null;
}

function fileUrl(jobId: string, name: string) {
  return `/api/file?job=${encodeURIComponent(jobId)}&name=${encodeURIComponent(name)}`;
}

function downloadAll(job: JobPublic) {
  job.parts.forEach((p, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = fileUrl(job.id, p.file);
      a.download = p.file;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 500);
  });
}

export function ResultPanel({ job }: ResultPanelProps) {
  // tombol buka folder hanya aktif di aplikasi desktop (Electron)
  const [canOpenFolder, setCanOpenFolder] = useState(false);
  useEffect(() => {
    setCanOpenFolder(typeof window.kolosalAPI?.openPath === "function");
  }, []);

  if (!job) return null;

  const processing = job.status === "queued" || job.status === "processing";

  return (
    <div className="glass rounded-xl p-4 relative flex flex-col gap-3">
      <HudCorners />
      <div className="flex items-center gap-2">
        {processing && <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />}
        {job.status === "done" && <CheckCircle2 className="w-4 h-4 text-cyan-300" />}
        {job.status === "error" && <AlertTriangle className="w-4 h-4 text-red-400" />}
        <h3 className="font-display text-[11px] font-bold tracking-[0.22em] text-zinc-100">
          {job.status === "done"
            ? "RENDER SELESAI"
            : job.status === "error"
              ? "RENDER GAGAL"
              : "SEDANG MERENDER"}
        </h3>
      </div>

      {processing && (
        <div className="flex flex-col gap-1.5">
          <Progress value={Math.round(job.progress * 100)} className="h-2.5" />
          <p className="font-tech text-[11px] text-cyan-200/80 tabular-nums">
            {job.phase} — {Math.round(job.progress * 100)}%
          </p>
        </div>
      )}

      {job.status === "error" && (
        <p className="text-xs text-red-300 leading-relaxed break-words">{job.error}</p>
      )}

      {job.status === "done" && job.parts.length > 0 && (
        <>
          {job.outDir && (
            <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/5 p-2.5 flex flex-col gap-1.5">
              <p className="text-[11px] leading-snug break-all">
                <FolderCheck
                  className="inline w-3.5 h-3.5 text-emerald-300 mr-1 -mt-0.5"
                  aria-hidden
                />
                <span className="text-emerald-200">Hasil tersimpan di:</span>{" "}
                <span className="text-zinc-300">{job.outDir}</span>
              </p>
              {canOpenFolder && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-emerald-300/40 text-emerald-200 hover:bg-emerald-400/10 hover:border-emerald-300/60 font-tech tracking-wider text-xs"
                  onClick={() => {
                    void window.kolosalAPI?.openPath(job.outDir!);
                  }}
                >
                  <FolderOpen className="w-4 h-4 mr-1.5" aria-hidden />
                  BUKA FOLDER HASIL
                </Button>
              )}
            </div>
          )}
          <Button
            onClick={() => downloadAll(job)}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-400 hover:from-cyan-400 hover:to-indigo-300 text-slate-950 font-semibold h-10 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          >
            <Download className="w-4 h-4 mr-1.5" aria-hidden />
            Unduh Semua ({job.parts.length} file)
          </Button>
          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto kolosal-scroll pr-1">
            {job.parts.map((p, i) => (
              <div
                key={p.file}
                className="flex items-center gap-3 rounded-lg border border-cyan-300/12 bg-slate-950/60 p-2 hover:border-cyan-300/35 transition-colors"
              >
                <img
                  src={fileUrl(job.id, p.thumb)}
                  alt={`Cover bagian ${i + 1}`}
                  className="w-[38px] h-[68px] object-cover rounded-md border border-cyan-300/20"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-200 truncate" title={p.file}>
                    {p.file}
                  </p>
                  <p className="font-tech text-[11px] text-cyan-100/45 tabular-nums">
                    {fmtDur(p.duration)} • {(p.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <a
                  href={fileUrl(job.id, p.file)}
                  download={p.file}
                  aria-label={`Unduh ${p.file}`}
                  className="rounded-md bg-cyan-400/10 border border-cyan-300/40 p-2 text-cyan-300 hover:bg-cyan-400/25 hover:shadow-[0_0_14px_rgba(34,211,238,0.5)] transition-all"
                >
                  <Download className="w-4 h-4" aria-hidden />
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      {processing && job.parts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {job.parts.map((p, i) => (
            <p key={p.file} className="font-tech text-[11px] text-cyan-300/80 flex items-center gap-1.5">
              <Film className="w-3 h-3" aria-hidden /> Bagian {i + 1} selesai
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
