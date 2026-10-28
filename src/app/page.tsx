"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadZone, UploadResult } from "@/components/kolosal/upload-zone";
import { PreviewCanvas } from "@/components/kolosal/preview-canvas";
import { SettingsPanel } from "@/components/kolosal/settings-panel";
import { ResultPanel } from "@/components/kolosal/result-panel";
import { HudCorners } from "@/components/kolosal/hud";
import {
  DEFAULT_SETTINGS,
  Settings,
  TextElement,
  computeSegments,
  fmtDur,
} from "@/lib/video-config";
import type { JobPublic } from "@/lib/server/jobs";
import { Button } from "@/components/ui/button";
import { Clapperboard, Sparkles, CircleAlert, Zap } from "lucide-react";
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

  const estParts = useMemo(
    () => (uploaded ? computeSegments(uploaded.duration, settings).length : 0),
    [uploaded, settings]
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
        <div className="max-w-[1500px] mx-auto px-4 h-16 flex items-center gap-3">
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

      {/* ===== KONTEN ===== */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)_390px] gap-4 items-start">
          {/* kolom kiri: upload */}
          <aside className="flex flex-col gap-4 order-1">
            <UploadZone
              uploaded={uploaded}
              onUploaded={onUploaded}
              onCleared={onCleared}
              onError={(m) => toast({ title: "Gagal unggah", description: m, variant: "destructive" })}
            />
            {uploaded && (
              <div className="glass rounded-xl p-4 relative flex flex-col gap-2.5">
                <HudCorners />
                <h3 className="flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.22em] text-zinc-100">
                  <Sparkles className="w-4 h-4 text-cyan-300" aria-hidden />
                  RINGKASAN
                </h3>
                <div className="font-tech text-xs text-zinc-400 flex flex-col gap-1.5 tabular-nums">
                  <div className="flex justify-between gap-2">
                    <span>DURASI VIDEO</span>
                    <span className="text-zinc-100">{fmtDur(uploaded.duration)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>
                      {settings.splitMode === "duration"
                        ? `POTONGAN @ ${settings.splitSeconds}S`
                        : `POTONGAN @ ${settings.splitParts} BAGIAN`}
                    </span>
                    <span className="neon-cyan font-semibold">{estParts} BAGIAN</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>HASIL AKHIR</span>
                    <span className="text-zinc-100">{estParts} FILE MP4</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>AUDIO</span>
                    <span className="text-zinc-100">{uploaded.hasAudio ? "ADA" : "TIDAK ADA"}</span>
                  </div>
                </div>
                {estParts >= 20 && (
                  <p className="text-[11px] text-amber-300/90 flex gap-1.5 items-start leading-snug">
                    <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                    Banyak bagian ({estParts}) — render akan memakan waktu cukup lama.
                  </p>
                )}
              </div>
            )}
          </aside>

          {/* kolom tengah: pratinjau */}
          <section className="order-2 flex justify-center lg:sticky lg:top-[84px]">
            <PreviewCanvas
              videoUrl={videoUrl}
              duration={uploaded?.duration ?? 0}
              settings={settings}
              onElementChange={onElementChange}
              coverPreview={coverPreview}
              onCoverPreviewChange={setCoverPreview}
              partNum={partNum}
              onPartNumChange={setPartNum}
              seekReq={seekReq}
            />
          </section>

          {/* kolom kanan: pengaturan + proses + hasil */}
          <aside className="order-3 flex flex-col gap-4 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto kolosal-scroll lg:pr-1 pb-6">
            <SettingsPanel settings={settings} onChange={onSettingsChange} hasVideo={!!uploaded} />

            <div className="glass rounded-xl p-4 relative flex flex-col gap-3 overflow-hidden">
              <HudCorners />
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" aria-hidden />
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
              <p className="font-tech text-[11px] text-zinc-400 leading-relaxed">
                Setiap bagian dijadikan file MP4 1080×1920 lengkap dengan cover, judul, label
                urutan, deskripsi, dan gaya frame yang dipilih.
              </p>
            </div>

            <ResultPanel job={job} />
          </aside>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-cyan-300/12 bg-slate-950/70">
        <div className="max-w-[1500px] mx-auto px-4 h-12 flex items-center justify-between">
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
