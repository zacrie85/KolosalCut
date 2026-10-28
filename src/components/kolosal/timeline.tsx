"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Segment, fmtDur } from "@/lib/video-config";
import {
  Sparkles,
  AudioLines,
  Clock3,
  Layers,
  Scissors,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface TimelineProps {
  duration: number;
  segs: Segment[];
  partNum: number;
  currentTime: number;
  hasAudio: boolean;
  caption: string;
  presetName: string;
  onPartSelect: (i: number) => void;
  /** pemberitahuan pembagian rata (mis. mode durasi melebihi 50 bagian) */
  notice?: string;
}

function rulerLabel(t: number) {
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Timeline — strip pengeditan ala software video profesional:
 * ruler waktu, klip potongan proporsional, playhead, dan gelombang audio.
 */
export function Timeline({
  duration,
  segs,
  partNum,
  currentTime,
  hasAudio,
  caption,
  presetName,
  onPartSelect,
  notice,
}: TimelineProps) {
  const step = useMemo(() => {
    const steps = [2, 5, 10, 15, 30, 60, 120, 300, 600];
    return steps.find((st) => duration / st <= 14) ?? 900;
  }, [duration]);

  const ticks = useMemo(() => {
    if (duration <= 0) return [];
    const arr: number[] = [];
    for (let t = 0; t <= duration + 0.01; t += step) arr.push(t);
    return arr;
  }, [duration, step]);

  // gelombang audio dekoratif deterministik (tidak berkedip antar render)
  // dibulatkan agar identik antara render server & client (hindari mismatch hidrasi)
  const bars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => {
        const v =
          Math.abs(Math.sin(i * 0.37) * 0.55) +
          Math.abs(Math.sin(i * 0.11 + 1.3) * 0.3) +
          Math.abs(Math.sin(i * 0.71 + 0.4) * 0.15);
        return Math.round((0.18 + Math.min(v, 1) * 0.82) * 1000) / 1000;
      }),
    []
  );

  const playhead = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const hasSegs = segs.length > 0;

  // ---- wadah gulir horizontal: cegah tombol bagian meluber ke menu lain ----
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [edge, setEdge] = useState({ can: false, start: true, end: true });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = {
      can: el.scrollWidth > el.clientWidth + 2,
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    };
    setEdge((prev) =>
      prev.can === next.can && prev.start === next.start && prev.end === next.end ? prev : next
    );
  }, []);

  // ukur ulang saat daftar bagian/durasi berubah atau ukuran panel berubah
  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, segs.length, duration]);

  // gulir otomatis ke bagian yang dipilih agar selalu terlihat di dalam panel
  useEffect(() => {
    const el = scrollRef.current;
    const btn = btnRefs.current[partNum - 1];
    if (!el || !btn || el.scrollWidth <= el.clientWidth + 2) return;
    const target = Math.max(
      0,
      Math.min(
        btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2,
        el.scrollWidth - el.clientWidth
      )
    );
    if (Math.abs(el.scrollLeft - target) > 8) {
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [partNum, segs.length]);

  const nudge = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <section
      aria-label="Timeline potongan video"
      className="glass rounded-2xl p-3 flex flex-col gap-2.5 shrink-0 overflow-hidden"
    >
      {/* ---- strip info gaya + ringkasan (ala label Effect di referensi) ---- */}
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <span className="font-tech text-[9px] tracking-wider rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-200 flex items-center gap-1.5 whitespace-nowrap">
          <Sparkles className="w-3 h-3" aria-hidden />
          GAYA: {presetName.toUpperCase()}
        </span>
        {hasSegs && (
          <span className="font-tech text-[9px] tracking-wider rounded-md border border-indigo-400/30 bg-indigo-400/10 px-2 py-1 text-indigo-200 flex items-center gap-1.5 whitespace-nowrap tabular-nums">
            <Layers className="w-3 h-3" aria-hidden />
            {segs.length} BAGIAN
          </span>
        )}
        <span className="font-tech text-[9px] tracking-wider rounded-md border border-zinc-600/50 bg-zinc-800/40 px-2 py-1 text-zinc-300 flex items-center gap-1.5 whitespace-nowrap tabular-nums">
          <Clock3 className="w-3 h-3" aria-hidden />
          {fmtDur(duration)}
        </span>
        {hasSegs && (
          <span className="font-tech text-[9px] tracking-wider rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2 py-1 text-emerald-200 flex items-center gap-1.5 whitespace-nowrap tabular-nums">
            <Scissors className="w-3 h-3" aria-hidden />
            TERBAGI HABIS
          </span>
        )}
        <span
          className={`font-tech text-[9px] tracking-wider rounded-md border px-2 py-1 flex items-center gap-1.5 whitespace-nowrap ${
            hasAudio
              ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
              : "border-zinc-700/60 bg-zinc-800/30 text-zinc-500"
          }`}
        >
          <AudioLines className="w-3 h-3" aria-hidden />
          {hasAudio ? "AUDIO" : "TANPA AUDIO"}
        </span>
        {caption && (
          <span className="ml-auto hidden md:block truncate font-tech text-[10px] text-zinc-500 max-w-[34%]">
            &ldquo;{caption}&rdquo;
          </span>
        )}
      </div>

      {/* ---- pemberitahuan pembagian rata (mode durasi > 50 bagian) ---- */}
      {notice && (
        <p className="text-[11px] text-amber-300/90 flex gap-1.5 items-start leading-snug">
          <Scissors className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
          {notice}
        </p>
      )}

      {/* ---- ruler + klip potongan + playhead (dalam wadah gulir: anti overflow) ---- */}
      <div className="relative">
        {hasSegs ? (
          <>
            <div
              ref={scrollRef}
              onScroll={measure}
              className="kolosal-scroll overflow-x-auto overflow-y-hidden pt-3 pb-2 -my-1"
            >
              <div className="relative w-max min-w-full">
                {/* ruler ikut menggulir agar selalu sejajar dengan klip */}
                <div className="relative h-4 mb-1.5 hidden sm:block" aria-hidden>
                  {ticks.map((t) => (
                    <div
                      key={t}
                      className="absolute top-0 flex flex-col items-center"
                      style={{ left: `${(t / duration) * 100}%`, transform: "translateX(-50%)" }}
                    >
                      <span className="font-tech text-[9px] leading-none text-zinc-500 tabular-nums whitespace-nowrap">
                        {rulerLabel(t)}
                      </span>
                      <span className="w-px h-1.5 bg-zinc-600/70 mt-1" />
                    </div>
                  ))}
                </div>

                <div className="relative flex gap-1 h-14" role="tablist" aria-label="Pilih bagian">
                  {segs.map((seg, i) => {
                    const active = partNum === i + 1;
                    return (
                      <button
                        key={i}
                        ref={(el) => {
                          btnRefs.current[i] = el;
                        }}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={`Bagian ${i + 1}, ${fmtDur(seg.dur)}`}
                        onClick={() => onPartSelect(i)}
                        style={{
                          flexGrow: Math.max(seg.dur, 0.4),
                          flexBasis: 0,
                          backgroundImage: active
                            ? "repeating-linear-gradient(115deg, rgba(103,232,249,0.10) 0 6px, transparent 6px 12px)"
                            : "repeating-linear-gradient(115deg, rgba(148,163,184,0.05) 0 6px, transparent 6px 12px)",
                        }}
                        className={`relative min-w-[30px] rounded-lg border px-1 overflow-hidden flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                          active
                            ? "border-cyan-300/80 bg-gradient-to-b from-cyan-400/25 to-indigo-500/20 shadow-[0_0_18px_-4px_rgba(34,211,238,0.75)] text-cyan-100"
                            : "border-zinc-700/70 bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span className="font-display text-[10px] font-bold leading-none">
                          P{i + 1}
                        </span>
                        <span className="font-tech text-[9px] leading-none opacity-70 tabular-nums">
                          {fmtDur(seg.dur)}
                        </span>
                        {active && (
                          <span
                            aria-hidden
                            className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                          />
                        )}
                      </button>
                    );
                  })}

                  {/* playhead — di dalam wadah gulir agar selalu sejajar dengan klip */}
                  {duration > 0 && (
                    <div
                      aria-hidden
                      className="absolute -top-1.5 bottom-0 w-px bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.85)] pointer-events-none"
                      style={{ left: `${playhead}%` }}
                    >
                      <span className="absolute -top-1 -left-[3.5px] w-2 h-2 rotate-45 bg-cyan-300 rounded-[2px]" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* tepi pudar + tombol panah — tampil hanya saat daftar bisa digulir */}
            {edge.can && !edge.start && (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0a1226]/95 via-[#0a1226]/60 to-transparent"
                />
                <button
                  type="button"
                  aria-label="Gulir daftar bagian ke kiri"
                  onClick={() => nudge(-1)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full border border-cyan-300/30 bg-slate-950/85 text-cyan-200 flex items-center justify-center hover:bg-cyan-400/20 hover:border-cyan-300/70 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </button>
              </>
            )}
            {edge.can && !edge.end && (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0a1226]/95 via-[#0a1226]/60 to-transparent"
                />
                <button
                  type="button"
                  aria-label="Gulir daftar bagian ke kanan"
                  onClick={() => nudge(1)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full border border-cyan-300/30 bg-slate-950/85 text-cyan-200 flex items-center justify-center hover:bg-cyan-400/20 hover:border-cyan-300/70 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="h-14 rounded-xl border border-dashed border-zinc-700/70 flex items-center justify-center font-tech text-[10px] tracking-wider text-zinc-600 text-center px-3">
            TIMELINE KOSONG — UNGGAH VIDEO UNTUK MEMBENTUK POTONGAN
          </div>
        )}
      </div>

      {/* ---- gelombang audio ---- */}
      <div
        className="relative h-8 rounded-lg bg-slate-950/60 border border-cyan-300/10 overflow-hidden flex items-center px-1"
        aria-hidden
      >
        <svg
          viewBox="0 0 270 32"
          preserveAspectRatio="none"
          className={`w-full h-full ${hasAudio ? "" : "opacity-25"}`}
        >
          <defs>
            <linearGradient id="kc-wave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          {bars.map((h, i) => (
            <rect
              key={i}
              x={i * 3}
              y={16 - (h * 13) / 2}
              width={2}
              height={h * 13}
              rx={1}
              fill="url(#kc-wave)"
            />
          ))}
        </svg>
        {!hasAudio && (
          <span className="absolute right-2 font-tech text-[9px] tracking-wider text-zinc-600">
            NO SIGNAL
          </span>
        )}
      </div>
    </section>
  );
}
