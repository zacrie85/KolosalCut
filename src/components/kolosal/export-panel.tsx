"use client";

// ============================================================
// KolosalCut v1.3.5 — MENU EKSPORT & SPLIT ala NOVACUT Studio
// Menggantikan seluruh menu ekspor & split lama (yang lambat & suka hang):
//  - Pembagian: EKSPORT SAJA / EKSPORT & SPLIT (jumlah / durasi) + estimasi
//  - MESIN RENDER: Kilat ⚡ (potong tanpa render ulang) / Render Penuh / Auto
//  - Kualitas & proses paralel
//  - Folder hasil
//  - Tombol MULAI EKSPORT besar + progres keseluruhan + ESTIMASI WAKTU
//  - BATALKAN per video & BATALKAN SEMUA (anti-hang — ffmpeg dibunuh)
// ============================================================

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { JobPublic } from "@/lib/server/jobs";
import {
  Settings,
  SplitMode,
  EngineKey,
  ENGINE_INFO,
  PARALLEL_OPTIONS,
  ParallelKey,
  QUALITY_INFO,
  QualityKey,
  computeSegments,
  isPureSplit,
  fmtDur,
} from "@/lib/video-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Rocket,
  Loader2,
  Scissors,
  Zap,
  Gauge,
  Layers,
  FolderOpen,
  FolderCheck,
  RotateCcw,
  Film,
  X,
  CircleAlert,
} from "lucide-react";

/** subscribe noop stabil untuk useSyncExternalStore */
const subscribeNoop = () => () => {};

export interface ExportItem {
  uid: string;
  name: string;
  status: string;
  uploadId?: string;
  jobId?: string;
  job?: JobPublic | null;
  info?: { duration: number } | null;
  settings: Settings;
}

interface ExportPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  items: ExportItem[];
  /** true saat tombol mulai sedang mengirim job */
  starting: boolean;
  onStart: () => void;
  onCancelJob: (jobId: string) => void;
  onCancelAll: () => void;
}

/** detik -> "45 dtk" / "12 mnt" / "1 j 05 mnt" */
function fmtEta(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "±sebentar";
  if (sec < 90) return `±${Math.round(sec)} dtk`;
  const m = Math.round(sec / 60);
  if (m < 90) return `±${m} mnt`;
  const h = Math.floor(m / 60);
  return `±${h} j ${(m % 60).toString().padStart(2, "0")} mnt`;
}

export function ExportPanel({
  settings: s,
  onChange,
  items,
  starting,
  onStart,
  onCancelJob,
  onCancelAll,
}: ExportPanelProps) {
  const isDesktop = useSyncExternalStore(
    subscribeNoop,
    () => Boolean(window.kolosalAPI?.selectOutputDir),
    () => false
  );

  const pickFolder = async () => {
    const api = window.kolosalAPI;
    if (!api?.selectOutputDir) return;
    try {
      const dir = await api.selectOutputDir();
      if (dir) onChange({ outputDir: dir });
    } catch {
      /* pengguna membatalkan / dialog gagal — abaikan */
    }
  };

  // ---- estimasi hasil (ala NOVACUT: "12:34 → ±5 video hasil") ----
  const ready = items.filter((i) => i.uploadId !== undefined && !i.jobId && i.status === "siap");
  const estFiles = ready.reduce(
    (m, it) => m + (it.info ? computeSegments(it.info.duration, it.settings).length : 0),
    0
  );
  const totalDur = ready.reduce((m, it) => m + (it.info?.duration ?? 0), 0);

  // ---- baris yang sedang dirender ----
  const activeRows = items.filter((i) => i.status === "antre" || i.status === "proses");
  const overall =
    activeRows.length > 0
      ? activeRows.reduce((m, r) => m + (r.job?.progress ?? 0), 0) / activeRows.length
      : 0;

  // ---- estimasi waktu tersisa (dari laju progres 20 detik terakhir) ----
  const [eta, setEta] = useState<number | null>(null);
  const histRef = useRef<Array<{ t: number; p: number }>>([]);
  useEffect(() => {
    if (activeRows.length === 0) {
      histRef.current = [];
      setEta(null);
      return;
    }
    const now = Date.now();
    const h = histRef.current;
    h.push({ t: now, p: overall });
    while (h.length > 0 && now - h[0].t > 20000) h.shift();
    if (h.length >= 2) {
      const first = h[0];
      const last = h[h.length - 1];
      const dt = (last.t - first.t) / 1000;
      const dp = last.p - first.p;
      if (dt > 4 && dp > 0.0005) {
        setEta(Math.max(1, Math.round((1 - last.p) / (dp / dt))));
      }
    }
  }, [overall]);

  // ---- status mesin utk pesan dinamis ----
  const pure = isPureSplit(s);
  const kilatWillRun = s.engine !== "penuh" && pure;

  const engineBtn = (key: EngineKey) => (
    <Button
      key={key}
      size="sm"
      variant={s.engine === key ? "default" : "outline"}
      className={`h-8 flex-1 text-xs ${
        s.engine === key
          ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]"
          : "border-zinc-700 text-zinc-300"
      }`}
      onClick={() => onChange({ engine: key })}
    >
      {key === "kilat" ? "⚡ " : ""}
      {ENGINE_INFO[key].label}
    </Button>
  );

  const modeBtn = (off: boolean, title: string, sub: string) => {
    const active = off ? s.splitMode === "off" : s.splitMode !== "off";
    return (
      <button
        type="button"
        onClick={() => onChange({ splitMode: off ? "off" : "duration" } as { splitMode: SplitMode })}
        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
          active
            ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.25)]"
            : "border-zinc-800 bg-white/[0.03] text-zinc-400 hover:border-zinc-600"
        }`}
      >
        {title}
        <span className="block text-[10px] font-normal text-zinc-500">{sub}</span>
      </button>
    );
  };

  return (
    <div className="glass rounded-2xl p-3 flex flex-col gap-3 shrink-0 relative overflow-hidden">
      <div aria-hidden className="absolute top-0 left-0 h-full w-[2px] bg-gradient-to-b from-fuchsia-400/70 via-fuchsia-500/15 to-transparent" />

      {/* ===== HEADER ===== */}
      <div className="flex items-center gap-2 px-1">
        <Rocket className="w-4 h-4 text-fuchsia-300" aria-hidden />
        <h2 className="font-display text-[11px] font-bold tracking-[0.22em] text-zinc-100">
          EKSPORT &amp; SPLIT
        </h2>
        <span className="font-tech text-[9px] tracking-[0.16em] text-zinc-500 ml-auto">
          ALA NOVACUT
        </span>
      </div>

      {/* ===== PEMBAGIAN ===== */}
      <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 p-3 flex flex-col gap-2.5">
        <p className="font-tech text-[10px] tracking-[0.18em] text-cyan-100/60 flex items-center gap-1.5">
          <Scissors className="w-3 h-3" aria-hidden /> PEMBAGIAN
        </p>
        <div className="grid grid-cols-2 gap-2">
          {modeBtn(true, "EKSPORT SAJA", "Tiap video jadi 1 file utuh")}
          {modeBtn(false, "EKSPORT & SPLIT", "Pecah otomatis jadi banyak video")}
        </div>

        {s.splitMode !== "off" && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={s.splitMode === "parts" ? "default" : "outline"}
                className={`h-8 flex-1 text-[11px] ${
                  s.splitMode === "parts"
                    ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
                    : "border-zinc-700 text-zinc-300"
                }`}
                onClick={() => onChange({ splitMode: "parts" })}
              >
                Berapa bagian
              </Button>
              <Button
                size="sm"
                variant={s.splitMode === "duration" ? "default" : "outline"}
                className={`h-8 flex-1 text-[11px] ${
                  s.splitMode === "duration"
                    ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
                    : "border-zinc-700 text-zinc-300"
                }`}
                onClick={() => onChange({ splitMode: "duration" })}
              >
                Durasi per video
              </Button>
            </div>
            {s.splitMode === "duration" ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-zinc-400 shrink-0">@</Label>
                <Input
                  type="number"
                  min={3}
                  max={3600}
                  value={s.splitSeconds}
                  onChange={(e) =>
                    onChange({ splitSeconds: Math.max(3, Math.min(3600, Number(e.target.value) || 3)) })
                  }
                  className="h-8 w-20 bg-zinc-950 border-zinc-700 text-xs"
                />
                <span className="text-xs text-zinc-400">detik / bagian</span>
                <div className="flex gap-1 ml-auto">
                  {[30, 60, 90].map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-[11px] border-zinc-700 text-zinc-300"
                      onClick={() => onChange({ splitSeconds: v })}
                    >
                      {v}s
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-zinc-400 shrink-0">Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={s.splitParts}
                  onChange={(e) =>
                    onChange({ splitParts: Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))) })
                  }
                  className="h-8 w-20 bg-zinc-950 border-zinc-700 text-xs"
                />
                <span className="text-xs text-zinc-400">bagian / video</span>
              </div>
            )}
            <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/5 px-2.5 py-1.5 font-mono text-[11px] text-cyan-200 tabular-nums">
              {fmtDur(totalDur)} → ±{estFiles} file hasil
              {ready.length > 1 ? ` (${ready.length} video)` : ""}
            </div>
          </div>
        )}
        {s.splitMode === "off" && (
          <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/5 px-2.5 py-1.5 font-mono text-[11px] text-cyan-200 tabular-nums">
            {fmtDur(totalDur)} → ±{ready.length || estFiles} file utuh (tanpa dipecah)
          </div>
        )}
      </div>

      {/* ===== MESIN RENDER ===== */}
      <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 p-3 flex flex-col gap-2.5">
        <p className="font-tech text-[10px] tracking-[0.18em] text-cyan-100/60 flex items-center gap-1.5">
          <Zap className="w-3 h-3" aria-hidden /> MESIN RENDER
        </p>
        <div className="flex gap-1.5">
          {engineBtn("auto")}
          {engineBtn("kilat")}
          {engineBtn("penuh")}
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">{ENGINE_INFO[s.engine].desc}</p>
        {kilatWillRun ? (
          <p className="text-[11px] text-emerald-300/90 flex items-start gap-1.5 leading-snug">
            <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            Setelan polos — MESIN KILAT aktif: potongan selesai hitungan detik, seperti menyalin file.
          </p>
        ) : s.engine === "kilat" ? (
          <p className="text-[11px] text-amber-300/90 flex items-start gap-1.5 leading-snug">
            <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            Ada cover/efek/teks aktif — mesin otomatis beralih ke render penuh agar gaya tidak hilang.
          </p>
        ) : null}

        {/* kualitas (render penuh) */}
        <div className="flex items-center gap-2 pt-1">
          <span className="font-tech text-[10px] tracking-[0.16em] text-zinc-500 flex items-center gap-1 shrink-0">
            <Gauge className="w-3 h-3" aria-hidden /> KUALITAS
          </span>
          <div className="flex gap-1.5 flex-1">
            {(Object.keys(QUALITY_INFO) as QualityKey[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={s.quality === k ? "default" : "outline"}
                className={`h-7 flex-1 text-[11px] ${
                  s.quality === k
                    ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
                    : "border-zinc-700 text-zinc-300"
                }`}
                onClick={() => onChange({ quality: k })}
              >
                {QUALITY_INFO[k].label}
              </Button>
            ))}
          </div>
        </div>

        {/* paralel */}
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] tracking-[0.16em] text-zinc-500 flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3" aria-hidden /> PARALEL
          </span>
          <div className="flex gap-1.5 flex-1">
            {PARALLEL_OPTIONS.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={s.parallel === n ? "default" : "outline"}
                className={`h-7 flex-1 text-[11px] ${
                  s.parallel === n
                    ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
                    : "border-zinc-700 text-zinc-300"
                }`}
                onClick={() => onChange({ parallel: n as ParallelKey })}
              >
                {n}×
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 leading-snug">
          {s.parallel === 1
            ? "Satu video dirender pada satu waktu — paling ringan untuk PC lama."
            : `${s.parallel} video dirender serentak — begitu satu selesai, antrean berikutnya langsung jalan.`}
        </p>
      </div>

      {/* ===== FOLDER HASIL ===== */}
      <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-tech text-[10px] tracking-[0.18em] text-cyan-100/60 flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" aria-hidden /> FOLDER HASIL
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className={`h-7 px-2 text-[11px] font-tech tracking-wider ${
                isDesktop
                  ? "border-cyan-300/40 text-cyan-200 hover:bg-cyan-400/10 hover:border-cyan-300/60"
                  : "border-zinc-700 text-zinc-500"
              }`}
              onClick={() => void pickFolder()}
            >
              PILIH FOLDER…
            </Button>
            {s.outputDir && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-zinc-700 text-zinc-300 hover:text-red-300 hover:border-red-400/50 text-[11px]"
                onClick={() => onChange({ outputDir: "" })}
              >
                <RotateCcw className="w-3 h-3" aria-hidden />
              </Button>
            )}
          </div>
        </div>
        <p className="text-[11px] leading-snug break-all">
          {s.outputDir ? (
            <>
              <FolderCheck className="inline w-3.5 h-3.5 text-emerald-300 mr-1 -mt-0.5" aria-hidden />
              <span className="text-emerald-200">Hasil disimpan ke:</span>{" "}
              <span className="text-zinc-300">{s.outputDir}</span>
            </>
          ) : (
            <span className="text-zinc-500">
              Belum dipilih — hasil disimpan ke folder data bawaan aplikasi.
            </span>
          )}
        </p>
      </div>

      {/* ===== TOMBOL MULAI ===== */}
      <Button
        onClick={onStart}
        disabled={ready.length === 0 || starting}
        className="h-12 w-full gap-2 font-display text-sm font-bold tracking-[0.06em] bg-gradient-to-r from-cyan-500 via-cyan-400 to-indigo-400 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.45)] hover:shadow-[0_0_40px_rgba(34,211,238,0.65)] hover:from-cyan-400 hover:to-indigo-300 border-0 disabled:opacity-40"
      >
        {starting ? (
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        ) : (
          <Rocket className="w-5 h-5" aria-hidden />
        )}
        {starting
          ? "MENGIRIM..."
          : `MULAI EKSPORT${estFiles > 0 ? ` (±${estFiles} FILE)` : ""}`}
      </Button>
      <p className="font-tech text-[10px] tracking-wider text-zinc-500 text-center leading-relaxed -mt-1">
        Video dirender di latar belakang — aplikasi boleh diperkecil, jangan ditutup.
      </p>

      {/* ===== PROGRES KERJA ===== */}
      {activeRows.length > 0 && (
        <div className="rounded-xl border border-cyan-300/20 bg-slate-950/70 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-tech text-[10px] tracking-[0.16em] text-cyan-100/70">
              MERENDER {activeRows.length} VIDEO
            </span>
            <span className="font-tech text-[10px] text-cyan-200 tabular-nums">
              {eta !== null ? `${fmtEta(eta)} · ` : ""}
              {Math.round(overall * 100)}%
            </span>
          </div>
          <Progress value={Math.max(2, Math.round(overall * 100))} className="h-2" />
          <div className="flex flex-col gap-1.5 pt-0.5">
            {activeRows.map((r) => (
              <div key={r.uid} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  {r.status === "proses" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300 shrink-0" />
                  ) : (
                    <Film className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  )}
                  <span className="text-xs text-zinc-300 truncate flex-1 min-w-0" title={r.name}>
                    {r.name}
                  </span>
                  <span className="font-tech text-[9px] text-cyan-100/60 truncate max-w-[130px] text-right">
                    {r.job?.phase ?? "MENUNGGU..."}
                  </span>
                  <button
                    type="button"
                    aria-label={`Batalkan ${r.name}`}
                    title="Batalkan video ini"
                    className="shrink-0 rounded p-1 text-zinc-500 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => r.jobId && onCancelJob(r.jobId)}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>
                <Progress
                  value={Math.max(2, Math.round((r.job?.progress ?? 0) * 100))}
                  className="h-1 ml-6"
                />
              </div>
            ))}
          </div>
          {activeRows.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 mt-1 border-red-400/40 text-red-300 hover:bg-red-500/10 hover:border-red-400/70 text-[11px] font-tech tracking-wider self-end"
              onClick={onCancelAll}
            >
              <X className="w-3 h-3 mr-1" aria-hidden />
              BATALKAN SEMUA
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
