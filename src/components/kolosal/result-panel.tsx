"use client";

// ============================================================
// KolosalCut v1.4.0 — Panel hasil render (mesin NOVACUT)
// Hasil kini langsung tersimpan ke folder pilihan pengguna pada
// aplikasi desktop (tulis streaming ke disk) — tampilan sama
// seperti versi sebelumnya. Mode web: unduh via blob.
// ============================================================

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Film,
  FolderOpen,
  FolderCheck,
} from "lucide-react";
import { fmtDur } from "@/lib/video-config";
import { HudCorners } from "@/components/kolosal/hud";

export interface KcResultFile {
  file: string;
  size: number;
  duration?: number;
  /** path disk (desktop — hasil sudah tersimpan otomatis) */
  savedPath?: string;
  /** blob URL (mode web — unduh manual) */
  url?: string;
  /** id video pemilik (atribusi internal) */
  kcJobId?: string;
}

export interface KcResult {
  status: "done" | "error";
  error?: string;
  outDir?: string;
  parts: KcResultFile[];
}

interface ResultPanelProps {
  result: KcResult | null;
}

export function ResultPanel({ result: job }: ResultPanelProps) {
  // tombol buka folder hanya aktif di aplikasi desktop (Electron)
  const [canOpenFolder, setCanOpenFolder] = useState(false);
  useEffect(() => {
    // dicek pasca-render via timeout — hindari setState sinkron dalam efek
    const id = setTimeout(
      () => setCanOpenFolder(typeof window.kolosalAPI?.openPath === "function"),
      0
    );
    return () => clearTimeout(id);
  }, []);

  if (!job) return null;

  if (job.status === "error") {
    return (
      <div className="glass rounded-xl p-4 relative flex flex-col gap-2">
        <HudCorners />
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="font-display text-[11px] font-bold tracking-[0.22em] text-zinc-100">
            RENDER GAGAL
          </h3>
        </div>
        <p className="text-xs text-red-300 leading-relaxed break-words">{job.error}</p>
      </div>
    );
  }

  const downloadAll = () => {
    job.parts.forEach((p, i) => {
      if (!p.url) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = p.url ?? "#";
        a.download = p.file;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 500);
    });
  };
  const hasBlob = job.parts.some((p) => p.url);

  return (
    <div className="glass rounded-xl p-4 relative flex flex-col gap-3">
      <HudCorners />
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-cyan-300" />
        <h3 className="font-display text-[11px] font-bold tracking-[0.22em] text-zinc-100">
          RENDER SELESAI
        </h3>
        <span className="font-tech text-[9px] tracking-wider rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">
          ⚡ MESIN NOVACUT
        </span>
      </div>

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

      {hasBlob && (
        <Button
          onClick={downloadAll}
          className="w-full bg-gradient-to-r from-cyan-500 to-indigo-400 hover:from-cyan-400 hover:to-indigo-300 text-slate-950 font-semibold h-10 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
        >
          <Download className="w-4 h-4 mr-1.5" aria-hidden />
          Unduh Semua ({job.parts.length} file)
        </Button>
      )}

      <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto kolosal-scroll pr-1">
        {job.parts.map((p, i) => (
          <div
            key={`${p.file}-${i}`}
            className="flex items-center gap-3 rounded-lg border border-cyan-300/12 bg-slate-950/60 p-2 hover:border-cyan-300/35 transition-colors"
          >
            <span className="w-[38px] h-[68px] rounded-md border border-cyan-300/20 bg-cyan-400/5 flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-cyan-300/70" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-200 truncate" title={p.file}>
                {p.file}
              </p>
              <p className="font-tech text-[11px] text-cyan-100/45 tabular-nums">
                {p.duration ? `${fmtDur(p.duration)} • ` : ""}
                {(p.size / 1024 / 1024).toFixed(1)} MB
                {p.savedPath ? " • tersimpan ✓" : ""}
              </p>
            </div>
            {p.url && (
              <a
                href={p.url}
                download={p.file}
                aria-label={`Unduh ${p.file}`}
                className="rounded-md bg-cyan-400/10 border border-cyan-300/40 p-2 text-cyan-300 hover:bg-cyan-400/25 hover:shadow-[0_0_14px_rgba(34,211,238,0.5)] transition-all"
              >
                <Download className="w-4 h-4" aria-hidden />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
