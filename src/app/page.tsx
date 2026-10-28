"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadZone, UploadResult } from "@/components/kolosal/upload-zone";
import { PreviewCanvas } from "@/components/kolosal/preview-canvas";
import { SettingsPanel } from "@/components/kolosal/settings-panel";
import { ResultPanel } from "@/components/kolosal/result-panel";
import {
  DEFAULT_SETTINGS,
  Settings,
  TextElement,
  computeSegments,
  fmtDur,
} from "@/lib/video-config";
import type { JobPublic } from "@/lib/server/jobs";
import { Button } from "@/components/ui/button";
import { Clapperboard, Sparkles, CircleAlert } from "lucide-react";
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70">
        <div className="max-w-[1500px] mx-auto px-4 h-14 flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/15 border border-amber-500/40 p-1.5">
            <Clapperboard className="w-5 h-5 text-amber-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-zinc-50 leading-none">
              Kolosal<span className="text-amber-400">Cut</span>
            </h1>
            <p className="text-[11px] text-zinc-400 leading-tight mt-0.5 hidden sm:block">
              Studio split & edit video 9:16 — gaya film kolosal & Hollywood
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            <span className="text-[11px] rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400">
              9:16 • 1080×1920
            </span>
            <span className="text-[11px] rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              7 Gaya Frame Film
            </span>
          </div>
        </div>
      </header>

      {/* ===== KONTEN ===== */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_380px] gap-4 items-start">
          {/* kolom kiri: upload */}
          <aside className="flex flex-col gap-3 order-1">
            <UploadZone
              uploaded={uploaded}
              onUploaded={onUploaded}
              onCleared={onCleared}
              onError={(m) => toast({ title: "Gagal unggah", description: m, variant: "destructive" })}
            />
            {uploaded && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" aria-hidden /> Ringkasan
                </h3>
                <div className="text-xs text-zinc-400 flex flex-col gap-1.5 tabular-nums">
                  <div className="flex justify-between">
                    <span>Durasi video</span>
                    <span className="text-zinc-200">{fmtDur(uploaded.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      {settings.splitMode === "duration"
                        ? `Potongan @ ${settings.splitSeconds}s`
                        : `Potongan @ ${settings.splitParts} bagian`}
                    </span>
                    <span className="text-amber-300 font-semibold">{estParts} bagian</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hasil akhir</span>
                    <span className="text-zinc-200">{estParts} file MP4</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio</span>
                    <span className="text-zinc-200">{uploaded.hasAudio ? "Ada" : "Tidak ada"}</span>
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
          <section className="order-2 flex justify-center lg:sticky lg:top-[72px]">
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
          <aside className="order-3 flex flex-col gap-3 lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto kolosal-scroll lg:pr-1 pb-6">
            <SettingsPanel settings={settings} onChange={onSettingsChange} hasVideo={!!uploaded} />

            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-zinc-900/60 p-4 flex flex-col gap-2.5">
              <Button
                onClick={startProcess}
                disabled={!uploaded || starting || (job != null && (job.status === "queued" || job.status === "processing"))}
                className="w-full h-11 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20"
              >
                {job && (job.status === "queued" || job.status === "processing")
                  ? "Sedang Merender..."
                  : `Render & Split Sekarang${estParts ? ` (${estParts} bagian)` : ""}`}
              </Button>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Setiap bagian dijadikan file MP4 1080×1920 lengkap dengan cover, judul, label urutan,
                deskripsi, dan gaya frame yang dipilih.
              </p>
            </div>

            <ResultPanel job={job} />
          </aside>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950">
        <div className="max-w-[1500px] mx-auto px-4 h-12 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">
            KolosalCut — dibuat dengan Next.js & FFmpeg
          </p>
          <p className="text-[11px] text-zinc-600 hidden sm:block">
            Semua pemrosesan berjalan lokal di server Anda
          </p>
        </div>
      </footer>
    </div>
  );
}
