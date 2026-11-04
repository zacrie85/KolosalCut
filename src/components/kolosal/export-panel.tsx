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
  Wrench,
  Eraser,
  Cpu,
  MemoryStick,
  Trash2,
  CheckCircle2,
} from "lucide-react";

/** subscribe noop stabil untuk useSyncExternalStore */
const subscribeNoop = () => () => {};

// ============================================================
// v1.3.6 — SISTEM & PERAWATAN (ala NOVACUT Studio)
// ============================================================
interface SystemTune {
  platform: string;
  cpuModel: string;
  cores: number;
  ramGB: number;
  freeGB: number;
  gpu: string | null;
  rec: { parallel: number; quality: QualityKey; threadsPerJob: number };
  reasons: string[];
}

interface CacheScan {
  dataDir: string;
  isDesktop: boolean;
  busy: boolean;
  uploads: { bytes: number; files: number };
  exports: { bytes: number; files: number };
  caches: { bytes: number; files: number };
  totalBytes: number;
}

/** byte -> "12,3 MB" / "1,2 GB" */
function fmtBytes(b: number): string {
  if (!isFinite(b) || b <= 0) return "0 MB";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

const TUNED_KEY = "kolosalcut.tuned";

export interface ExportItem {
  uid: string;
  name: string;
  status: string;
  uploadId?: string;
  /** progres render mesin NOVACUT (0..1) */
  kcProgress?: number;
  /** keterangan fase render */
  kcPhase?: string;
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
  const ready = items.filter((i) => i.uploadId !== undefined && i.status === "siap");
  const estFiles = ready.reduce(
    (m, it) => m + (it.info ? computeSegments(it.info.duration, it.settings).length : 0),
    0
  );
  const totalDur = ready.reduce((m, it) => m + (it.info?.duration ?? 0), 0);

  // ---- baris yang sedang dirender ----
  const activeRows = items.filter((i) => i.status === "antre" || i.status === "proses");
  const overall =
    activeRows.length > 0
      ? activeRows.reduce((m, r) => m + (r.kcProgress ?? 0), 0) / activeRows.length
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

  // ---- v1.3.6: SISTEM & PERAWATAN ----
  const [sysBusy, setSysBusy] = useState(false);
  const [sysInfo, setSysInfo] = useState<SystemTune | null>(null);
  const [sysErr, setSysErr] = useState<string | null>(null);
  const [scan, setScan] = useState<CacheScan | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearErr, setClearErr] = useState<string | null>(null);
  const [selUploads, setSelUploads] = useState(true);
  const [selExports, setSelExports] = useState(false);
  const [selCaches, setSelCaches] = useState(true);

  const runOptimize = async () => {
    setSysBusy(true);
    setSysErr(null);
    try {
      const res = await fetch("/api/system", { method: "POST" });
      const data = (await res.json()) as SystemTune & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Gagal membaca spesifikasi PC");
      setSysInfo(data);
      // terapkan langsung rekomendasi + simpan agar berlaku juga setelah aplikasi dibuka lagi
      onChange({ quality: data.rec.quality, parallel: data.rec.parallel as ParallelKey });
      try {
        localStorage.setItem(
          TUNED_KEY,
          JSON.stringify({ quality: data.rec.quality, parallel: data.rec.parallel })
        );
      } catch {
        /* penyimpanan lokal tidak tersedia — abaikan */
      }
    } catch (e) {
      setSysErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSysBusy(false);
    }
  };

  const runScan = async () => {
    setScanBusy(true);
    setClearMsg(null);
    setClearErr(null);
    try {
      const res = await fetch("/api/cache");
      const data = (await res.json()) as CacheScan & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Gagal memindai cache");
      setScan(data);
    } catch (e) {
      setClearErr(e instanceof Error ? e.message : String(e));
    } finally {
      setScanBusy(false);
    }
  };

  const runClear = async () => {
    setClearBusy(true);
    setClearErr(null);
    try {
      const res = await fetch("/api/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploads: selUploads, exports: selExports, caches: selCaches }),
      });
      const data = (await res.json()) as { freedBytes?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Gagal membersihkan");
      setClearMsg(`Berhasil — ${fmtBytes(data.freedBytes ?? 0)} data sisa dilepas. Aplikasi kembali ramping.`);
      setScan(null); // tutup rincian; bisa dipindai ulang
    } catch (e) {
      setClearErr(e instanceof Error ? e.message : String(e));
    } finally {
      setClearBusy(false);
    }
  };

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
                    {r.kcPhase ?? "MENUNGGU..."}
                  </span>
                  <button
                    type="button"
                    aria-label={`Batalkan ${r.name}`}
                    title="Batalkan video ini"
                    className="shrink-0 rounded p-1 text-zinc-500 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => r.uid && onCancelJob(r.uid)}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>
                <Progress
                  value={Math.max(2, Math.round((r.kcProgress ?? 0) * 100))}
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

      {/* ===== v1.3.6: SISTEM & PERAWATAN ===== */}
      <div className="rounded-xl border border-cyan-300/15 bg-slate-950/60 p-3 flex flex-col gap-2.5">
        <p className="font-tech text-[10px] tracking-[0.18em] text-cyan-100/60 flex items-center gap-1.5">
          <Wrench className="w-3 h-3" aria-hidden /> SISTEM &amp; PERAWATAN
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void runOptimize()}
            disabled={sysBusy}
            className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-3 py-2.5 text-left transition hover:border-emerald-300/70 hover:bg-emerald-400/15 disabled:opacity-40"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
              {sysBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Gauge className="w-3.5 h-3.5" aria-hidden />
              )}
              OPTIMALKAN
            </span>
            <span className="block text-[10px] font-normal text-emerald-300/60 leading-snug mt-0.5">
              Baca PC-mu, atur otomatis setelan tercepat
            </span>
          </button>
          <button
            type="button"
            onClick={() => (scan ? setScan(null) : void runScan())}
            disabled={scanBusy || clearBusy}
            className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2.5 text-left transition hover:border-amber-300/70 hover:bg-amber-400/15 disabled:opacity-40"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
              {scanBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Eraser className="w-3.5 h-3.5" aria-hidden />
              )}
              BERSIHKAN CACHE
            </span>
            <span className="block text-[10px] font-normal text-amber-300/60 leading-snug mt-0.5">
              Hapus sisa data olahan, kembali ramping
            </span>
          </button>
        </div>

        {sysErr && (
          <p className="text-[11px] text-red-300/90 flex items-start gap-1.5 leading-snug">
            <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {sysErr}
          </p>
        )}
        {clearErr && (
          <p className="text-[11px] text-red-300/90 flex items-start gap-1.5 leading-snug">
            <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {clearErr}
          </p>
        )}
        {clearMsg && (
          <p className="text-[11px] text-emerald-300/90 flex items-start gap-1.5 leading-snug">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {clearMsg}
          </p>
        )}

        {/* hasil OPTIMALKAN */}
        {sysInfo && (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/5 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-tech text-[10px] tracking-wider text-emerald-200 flex items-center gap-1">
                <Cpu className="w-3 h-3" aria-hidden /> {sysInfo.cores} CORE
              </span>
              <span className="text-zinc-600">·</span>
              <span className="font-tech text-[10px] tracking-wider text-emerald-200 flex items-center gap-1">
                <MemoryStick className="w-3 h-3" aria-hidden /> RAM {sysInfo.ramGB} GB
              </span>
              {sysInfo.gpu && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="font-tech text-[10px] tracking-wider text-emerald-200 truncate max-w-[140px]" title={sysInfo.gpu}>
                    {sysInfo.gpu}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-emerald-100/90 leading-snug">
              Setelan terpasang otomatis: <b className="text-emerald-200">PARALEL {sysInfo.rec.parallel}×</b> ·{" "}
              <b className="text-emerald-200">KUALITAS {QUALITY_INFO[sysInfo.rec.quality].label.toUpperCase()}</b> ·{" "}
              <b className="text-emerald-200">{sysInfo.rec.threadsPerJob} thread/video</b>
              {sysInfo.rec.parallel > 1 ? " — core dibagi rata agar tidak saling berebut." : " — paling aman untuk PC ini."}
            </p>
            <p className="text-[10px] text-zinc-500 leading-snug">
              CPU: {sysInfo.cpuModel}
              {sysInfo.freeGB > 0 ? ` · RAM bebas ${sysInfo.freeGB} GB` : ""}
            </p>
          </div>
        )}

        {/* hasil pemindaian CACHE */}
        {scan && (
          <div className="rounded-lg border border-amber-300/25 bg-amber-400/5 p-2.5 flex flex-col gap-2">
            <p className="text-[10px] text-amber-100/80 font-tech tracking-wider">
              TOTAL SISA DATA: {fmtBytes(scan.totalBytes)}
            </p>
            {scan.busy ? (
              <p className="text-[11px] text-amber-300 flex items-start gap-1.5 leading-snug">
                <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                Ada video sedang dirender — tunggu selesai / batalkan dulu sebelum membersihkan.
              </p>
            ) : (
              <>
                <CheckRow
                  checked={selUploads}
                  onToggle={() => setSelUploads((v) => !v)}
                  label={`Sisa video sumber & data sementara — ${fmtBytes(scan.uploads.bytes)} (${scan.uploads.files} file)`}
                  sub="Video yang pernah kamu tambahkan. Aman dihapus, tinggal tambahkan ulang bila perlu."
                />
                <CheckRow
                  checked={selExports}
                  onToggle={() => setSelExports((v) => !v)}
                  label={`Hasil render di folder bawaan — ${fmtBytes(scan.exports.bytes)} (${scan.exports.files} file)`}
                  sub="Perhatian: ini video HASIL. Lewati bila masih ingin menyimpannya di sini."
                />
                <CheckRow
                  checked={selCaches}
                  onToggle={() => setSelCaches((v) => !v)}
                  label={`Cache aplikasi & log — ${fmtBytes(scan.caches.bytes)}`}
                  sub="Cache tampilan & catatan log. Aman dihapus, dibuat ulang otomatis."
                />
                <Button
                  size="sm"
                  className="h-8 w-full font-tech tracking-wider text-[11px] font-semibold bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 hover:from-amber-300 hover:to-orange-300 border-0 disabled:opacity-40"
                  disabled={clearBusy || (!selUploads && !selExports && !selCaches)}
                  onClick={() => void runClear()}
                >
                  {clearBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" aria-hidden />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" aria-hidden />
                  )}
                  BERSIHKAN SEKARANG
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** baris pilihan pembersihan (checkbox kustom gaya panel) */
function CheckRow({
  checked,
  onToggle,
  label,
  sub,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
        checked
          ? "border-amber-300/50 bg-amber-400/10"
          : "border-zinc-800 bg-white/[0.02] hover:border-zinc-600"
      }`}
    >
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
          checked ? "border-amber-300 bg-amber-300 text-slate-950" : "border-zinc-600 text-transparent"
        }`}
        aria-hidden
      >
        <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={3.5} />
      </span>
      <span className="min-w-0">
        <span className={`block text-[11px] leading-snug ${checked ? "text-amber-100" : "text-zinc-400"}`}>
          {label}
        </span>
        {sub && <span className="block text-[10px] text-zinc-500 leading-snug">{sub}</span>}
      </span>
    </button>
  );
}
