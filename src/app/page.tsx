"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadZone, UploadResult } from "@/components/kolosal/upload-zone";
import { PreviewCanvas } from "@/components/kolosal/preview-canvas";
import { SettingsPanel } from "@/components/kolosal/settings-panel";
import { ResultPanel } from "@/components/kolosal/result-panel";
import { Timeline } from "@/components/kolosal/timeline";
import {
  DEFAULT_SETTINGS,
  Settings,
  TextElement,
  computeSegments,
  fmtDur,
  FRAME_PRESETS,
} from "@/lib/video-config";
import type { JobPublic } from "@/lib/server/jobs";
import { Button } from "@/components/ui/button";
import { Clapperboard, CircleAlert, Zap, UploadCloud } from "lucide-react";
import { HudCorners } from "@/components/kolosal/hud";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [job, setJob] = useState<JobPublic | null>(null);
  const [starting, setStarting] = useState(false);
  const [coverPreview, setCoverPreview] = useState(false);
  const [partNum, setPartNum] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekReq, setSeekReq] = useState<{ t: number; k: number } | null>(null);
  const urlRef = useRef<string | null>(null);

  // polling status job
  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "processing")) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/job?id=${encodeURIComponent(job.id)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as JobPublic;
          setJob(data);
          if (data.status === "error") {
            toast({ title: "Render gagal", description: data.error, variant: "destructive" });
          }
        }
      } catch {
        /* abaikan sementara */
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [job?.id, job?.status, toast]);

  const onUploaded = useCallback(
    (info: UploadResult, url: string) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setUploaded(info);
      setVideoUrl(url);
      setJob(null);
      setPartNum(1);
      setCurrentTime(0);
      setCoverPreview(false);
      setSettings((s) => ({ ...s, title: { ...s.title, text: info.title } }));
      toast({
        title: "Video siap",
        description: `${info.originalName} — ${fmtDur(info.duration)}`,
      });
    },
    [toast]
  );

  const onCleared = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUploaded(null);
    setVideoUrl(null);
    setJob(null);
    setCurrentTime(0);
  }, []);

  const onElementChange = useCallback((key: string, el: Partial<TextElement>) => {
    setSettings((s) => ({
      ...s,
      [key]: { ...(s[key as "title" | "label" | "desc"] as TextElement), ...el },
    }));
  }, []);

  const onSettingsChange = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const segs = useMemo(
    () => (uploaded ? computeSegments(uploaded.duration, settings) : []),
    [uploaded, settings]
  );
  const estParts = segs.length;

  // pilih bagian dari timeline — seek otomatis (atau lewat efek cover)
  const selectPart = useCallback(
    (i: number) => {
      setPartNum(i + 1);
      if (coverPreview) return; // efek coverPreview me-seek frame cover
      const seg = segs[i];
      if (seg) setSeekReq({ t: Math.max(0, seg.start + 0.05), k: Date.now() });
    },
    [coverPreview, segs]
  );

  const startProcess = useCallback(async () => {
    if (!uploaded || starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: uploaded.uploadId,
          originalName: uploaded.originalName,
          title: settings.title.text.trim() || uploaded.title,
          duration: uploaded.duration,
          width: uploaded.width,
          height: uploaded.height,
          hasAudio: uploaded.hasAudio,
          settings,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setJob({
          id: data.jobId,
          status: "queued",
          phase: "Menunggu antrean...",
          progress: 0,
          total: estParts,
          parts: [],
          title: settings.title.text,
          createdAt: Date.now(),
        });
        setCoverPreview(false);
        toast({ title: "Render dimulai", description: `${estParts} bagian sedang diproses.` });
      } else {
        toast({ title: "Gagal memulai", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({
        title: "Gagal memulai",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  }, [uploaded, starting, settings, estParts, toast]);

  const renderBusy = job != null && (job.status === "queued" || job.status === "processing");

  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-x-clip">
      {/* ===== LATAR BELAKANG HUD ===== */}
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_-8%,rgba(34,211,238,0.13),transparent_70%),radial-gradient(ellipse_55%_45%_at_105%_105%,rgba(129,140,248,0.11),transparent_70%)]" />
        <div className="orb anim-drift-a w-[420px] h-[420px] -top-24 -left-24 bg-cyan-500/25" />
        <div className="orb anim-drift-b w-[480px] h-[480px] top-1/3 -right-40 bg-indigo-500/20" />
        <div className="orb anim-drift-a w-[300px] h-[300px] bottom-0 left-1/3 bg-fuchsia-500/10" />
        <div className="absolute inset-0 grid-overlay" />
      </div>

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 border-b border-cyan-300/15 bg-slate-950/75 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center gap-3">
          <div className="relative rounded-lg bg-cyan-400/10 border border-cyan-300/40 p-2 shadow-[0_0_22px_rgba(34,211,238,0.4)]">
            <Clapperboard className="w-5 h-5 text-cyan-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-extrabold tracking-[0.14em] leading-none">
              KOLOSAL<span className="title-gradient">CUT</span>
            </h1>
            <p className="font-tech text-[10px] text-cyan-100/50 leading-tight mt-1 tracking-[0.18em] hidden sm:block">
              NEON VIDEO ENGINE // SPLIT STUDIO 9:16
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            <span className="font-tech text-[10px] tracking-wider rounded border border-cyan-300/30 bg-cyan-400/5 px-2.5 py-1.5 text-cyan-200 flex items-center gap-1.5">
              <span className="led w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" aria-hidden />
              9:16 • 1080×1920
            </span>
            <span className="font-tech text-[10px] tracking-wider rounded border border-indigo-400/30 bg-indigo-400/5 px-2.5 py-1.5 text-indigo-200">
              7 GAYA FRAME FILM
            </span>
          </div>
        </div>
        <div className="h-px w-full data-stream opacity-70" aria-hidden />
      </header>

      {/* ===== KONTEN — LAYOUT EDITOR ===== */}
      <main className="app-editor-h flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_392px] gap-3 flex-1 lg:min-h-0 min-w-0">
          {/* ================= KOLOM KIRI: STAGE + TIMELINE ================= */}
          <div className="flex flex-col gap-3 lg:min-h-0 min-w-0">
            {/* stage pratinjau besar */}
            <div className="glass rounded-2xl relative overflow-hidden flex flex-col h-[74vh] min-h-[440px] lg:h-auto lg:flex-1 lg:min-h-0">
              <HudCorners />
              {uploaded ? (
                <PreviewCanvas
                  videoUrl={videoUrl}
                  duration={uploaded.duration}
                  settings={settings}
                  onElementChange={onElementChange}
                  coverPreview={coverPreview}
                  onCoverPreviewChange={setCoverPreview}
                  partNum={partNum}
                  onPartNumChange={setPartNum}
                  seekReq={seekReq}
                  onTimeChange={setCurrentTime}
                />
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6">
                  <div className="w-full max-w-md">
                    <UploadZone
                      variant="stage"
                      uploaded={uploaded}
                      onUploaded={onUploaded}
                      onCleared={onCleared}
                      onError={(m) =>
                        toast({ title: "Gagal unggah", description: m, variant: "destructive" })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* timeline ala software edit video */}
            <Timeline
              duration={uploaded?.duration ?? 0}
              segs={segs}
              partNum={partNum}
              currentTime={currentTime}
              hasAudio={uploaded?.hasAudio ?? false}
              caption={settings.desc.text.trim() || settings.title.text.trim()}
              presetName={
                FRAME_PRESETS.find((p) => p.key === settings.preset)?.name ?? "Tanpa Gaya"
              }
              onPartSelect={selectPart}
            />
          </div>

          {/* ================= KOLOM KANAN: PANEL TAB ================= */}
          <aside className="flex flex-col gap-3 lg:min-h-0 min-w-0">
            <div className="glass rounded-2xl p-3 flex flex-col gap-3 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              {/* sumber video — ala seksi Music di referensi */}
              {uploaded ? (
                <UploadZone
                  variant="card"
                  uploaded={uploaded}
                  onUploaded={onUploaded}
                  onCleared={onCleared}
                  onError={(m) =>
                    toast({ title: "Gagal unggah", description: m, variant: "destructive" })
                  }
                />
              ) : (
                <div className="rounded-xl border border-dashed border-cyan-300/25 bg-slate-950/40 p-3 flex items-center gap-2.5 shrink-0">
                  <div className="rounded-lg bg-cyan-400/10 border border-cyan-300/30 p-2 shrink-0">
                    <UploadCloud className="w-4 h-4 text-cyan-300" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-200">Belum ada video</p>
                    <p className="font-tech text-[10px] tracking-wider text-cyan-100/50 mt-0.5">
                      UNGGAH LEWAT AREA PRATINJAU DI KIRI
                    </p>
                  </div>
                </div>
              )}

              <div
                className="h-px bg-gradient-to-r from-cyan-300/25 via-cyan-300/10 to-transparent shrink-0"
                aria-hidden
              />

              {/* tab Video / Teks / Gaya + isinya */}
              <SettingsPanel
                settings={settings}
                onChange={onSettingsChange}
                hasVideo={!!uploaded}
              />

              {/* CTA render — menempel di dasar panel (ala kotak AI di referensi) */}
              <div className="shrink-0 flex flex-col gap-2 pt-1">
                <Button
                  onClick={startProcess}
                  disabled={!uploaded || starting || renderBusy}
                  className="w-full h-12 font-display text-sm font-bold tracking-[0.08em] bg-gradient-to-r from-cyan-500 via-cyan-400 to-indigo-400 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.45)] hover:shadow-[0_0_40px_rgba(34,211,238,0.65)] hover:from-cyan-400 hover:to-indigo-300 border-0"
                >
                  <Zap className="w-4 h-4 mr-1.5" aria-hidden />
                  {renderBusy
                    ? "SEDANG MERENDER..."
                    : `RENDER & SPLIT${estParts ? ` — ${estParts} BAGIAN` : ""}`}
                </Button>
                <p className="font-tech text-[10px] tracking-wider text-zinc-500 text-center leading-relaxed">
                  TIAP BAGIAN JADI MP4 1080×1920 • COVER • JUDUL • LABEL • DESKRIPSI
                </p>
                {estParts >= 20 && (
                  <p className="text-[11px] text-amber-300/90 flex gap-1.5 items-start leading-snug">
                    <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                    Banyak bagian ({estParts}) — render akan memakan waktu cukup lama.
                  </p>
                )}
              </div>
            </div>

            {/* hasil render */}
            {job && <ResultPanel job={job} />}
          </aside>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-cyan-300/12 bg-slate-950/70">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between">
          <p className="font-tech text-[10px] tracking-[0.2em] text-cyan-100/40">
            KOLOSALCUT // NEXT.JS + FFMPEG ENGINE
          </p>
          <p className="font-tech text-[10px] tracking-[0.2em] text-zinc-600 hidden sm:block">
            SEMUA PROSES BERJALAN LOKAL
          </p>
        </div>
      </footer>
    </div>
  );
}
