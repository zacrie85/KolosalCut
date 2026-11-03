"use client";

import { useEffect, useRef, useState } from "react";
import {
  Settings,
  LabelFormat,
  FRAME_STYLES,
  FONT_OPTIONS,
  FontKey,
  TextElement,
  SUB_MODES_INFO,
  SUB_MODE_KEYS,
  SUB_STYLES_INFO,
  SUB_STYLE_KEYS,
  SubMode,
  SubStyle,
  labelTextFor,
} from "@/lib/video-config";
import {
  CLIP_EFFECTS,
  TRANSITIONS,
  TRANSITION_CATS,
  COVER_TEMPLATES,
  getCoverTemplate,
  getTransition,
  aiRecommendTemplates,
  type TransitionMeta,
} from "@/lib/novacut-fx";
import {
  renderCoverCanvas,
  grabFrame,
  loadImage,
  sampleBrightness,
  COVER_FRAME_OPTIONS,
  type CoverFrameStyle,
} from "@/lib/cover-render";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Scissors,
  Image as ImageIcon,
  Type,
  Hash,
  MessageSquare,
  Palette,
  Proportions,
  Gauge,
  Move,
  Layers,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Captions,
  Expand,
  Crosshair,
  Wand2,
  Sparkles,
  LayoutGrid,
  Check,
  Zap,
  Upload,
  Eraser,
  Frame,
} from "lucide-react";

type SettingsTab = "video" | "teks" | "gaya" | "efek" | "cover";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  hasVideo: boolean;
  /** ukuran video terpilih — untuk menghitung tombol ISI FRAME (v1.3.5) */
  videoWidth?: number;
  videoHeight?: number;
  /** url video terpilih & durasinya — pratinjau cover (v1.3.5) */
  videoUrl?: string | null;
  videoDuration?: number;
}

function Section({
  num,
  icon,
  title,
  children,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl relative overflow-hidden group">
      <div
        aria-hidden
        className="absolute top-0 left-0 h-full w-[2px] bg-gradient-to-b from-cyan-300/70 via-cyan-400/15 to-transparent"
      />
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <span className="font-tech text-[10px] text-cyan-400/70" aria-hidden>
          {num}
        </span>
        <span className="text-cyan-300">{icon}</span>
        <h3 className="font-display text-[11px] font-bold tracking-[0.18em] uppercase text-zinc-100 group-hover:text-cyan-200 transition-colors">
          {title}
        </h3>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

const clampX = (v: number) => Math.min(0.98, Math.max(0.02, v));
const clampY = (v: number) => Math.min(0.99, Math.max(0.01, v));

/**
 * PositionPad — pengganti pilihan atas/tengah/bawah.
 * Posisi teks digeser BEBAS ke atas, bawah, kiri, dan kanan lewat:
 * 1. drag titik di mini-pad 9:16, atau
 * 2. tombol panah untuk geser halus.
 */
function PositionPad({
  el,
  onChange,
  disabled,
}: {
  el: TextElement;
  onChange: (patch: Partial<TextElement>) => void;
  disabled?: boolean;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const applyFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const relX = clampX((e.clientX - rect.left) / rect.width);
    const relY = clampY((e.clientY - rect.top) / rect.height);
    onChange({ relX, relY });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyFromPointer(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    applyFromPointer(e);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  const nudge = (dx: number, dy: number) =>
    onChange({ relX: clampX(el.relX + dx), relY: clampY(el.relY + dy) });

  const arrowCls =
    "h-8 w-8 p-0 border-cyan-300/25 text-zinc-300 hover:bg-cyan-400/10 hover:text-cyan-200 hover:border-cyan-300/60 disabled:opacity-40";

  return (
    <div className="flex items-center gap-3">
      {/* mini-pad 9:16 — drag bebas */}
      <div
        ref={padRef}
        role="slider"
        aria-label="Geser posisi teks (atas, bawah, kiri, kanan)"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(el.relX * 100)}
        aria-valuetext={`horizontal ${Math.round(el.relX * 100)}%, vertikal ${Math.round(el.relY * 100)}%`}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = e.shiftKey ? 0.06 : 0.02;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            nudge(0, -step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            nudge(0, step);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            nudge(-step, 0);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            nudge(step, 0);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative shrink-0 w-[72px] aspect-[9/16] rounded-lg border bg-slate-950 touch-none select-none ${
          disabled ? "border-zinc-800 opacity-50" : "border-cyan-300/35 cursor-grab active:cursor-grabbing shadow-[0_0_14px_-4px_rgba(34,211,238,0.5)]"
        }`}
        style={{
          backgroundImage:
            "linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)",
          backgroundSize: "25% 25%",
        }}
      >
        {/* garis tengah horizontal sebagai panduan */}
        <div className="absolute inset-x-1 top-1/2 border-t border-dashed border-cyan-300/15 pointer-events-none" />
        {/* titik posisi teks */}
        <div
          className="absolute w-5 h-5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.8)] pointer-events-none"
          style={{
            left: `${el.relX * 100}%`,
            top: `${el.relY * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* tombol panah: geser halus atas bawah kiri kanan */}
      <div className="flex flex-col items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className={arrowCls}
          aria-label="Geser ke atas"
          onClick={() => nudge(0, -0.02)}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className={arrowCls}
            aria-label="Geser ke kiri"
            onClick={() => nudge(-0.02, 0)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-8 w-8 p-0 border-cyan-300/25 text-zinc-400 hover:bg-cyan-400/10 hover:text-cyan-200 hover:border-cyan-300/60 disabled:opacity-40"
            aria-label="Pusatkan horizontal"
            title="Pusatkan horizontal"
            onClick={() => onChange({ relX: 0.5 })}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className={arrowCls}
            aria-label="Geser ke kanan"
            onClick={() => nudge(0.02, 0)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className={arrowCls}
          aria-label="Geser ke bawah"
          onClick={() => nudge(0, 0.02)}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* readout posisi */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Move className="w-3.5 h-3.5 text-cyan-300 shrink-0" aria-hidden />
          <span className="tabular-nums">
            X {Math.round(el.relX * 100)}% · Y {Math.round(el.relY * 100)}%
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug mt-1">
          Geser titik di kotak mini (bebas semua arah) atau pakai tombol panah. Bisa juga geser
          langsung teksnya di pratinjau video.
        </p>
      </div>
    </div>
  );
}

/** pad panah 4 arah kecil — dipakai ZOOM & GESER (v1.3.5) */
function PanPad({
  onNudge,
  disabled,
}: {
  onNudge: (dx: number, dy: number) => void;
  disabled?: boolean;
}) {
  const arrowCls =
    "h-8 w-8 p-0 border-cyan-300/25 text-zinc-300 hover:bg-cyan-400/10 hover:text-cyan-200 hover:border-cyan-300/60 disabled:opacity-40";
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <Button type="button" size="sm" variant="outline" disabled={disabled} className={arrowCls} aria-label="Geser gambar ke atas" onClick={() => onNudge(0, -0.02)}>
        <ChevronUp className="w-4 h-4" />
      </Button>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="outline" disabled={disabled} className={arrowCls} aria-label="Geser gambar ke kiri" onClick={() => onNudge(-0.02, 0)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} className="h-8 w-8 p-0 border-cyan-300/25 text-zinc-400 hover:bg-cyan-400/10 hover:text-cyan-200 hover:border-cyan-300/60 disabled:opacity-40" aria-label="Tengahkan gambar" title="Tengahkan gambar" onClick={() => onNudge(0, 0)}>
          <Crosshair className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} className={arrowCls} aria-label="Geser gambar ke kanan" onClick={() => onNudge(0.02, 0)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={disabled} className={arrowCls} aria-label="Geser gambar ke bawah" onClick={() => onNudge(0, 0.02)}>
        <ChevronDown className="w-4 h-4" />
      </Button>
    </div>
  );
}

/** gaya chip kategori transisi (ala panel efek NOVACUT) */
const CAT_STYLE: Record<TransitionMeta["cat"], string> = {
  trailer: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  iklan: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  sinematik: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  trend: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300",
};

/** pemilih 28 transisi dgn tab kategori — port dari EffectsPanel NOVACUT */
function TransitionPicker({
  active,
  onPick,
  disabled,
}: {
  active: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const [cat, setCat] = useState<TransitionMeta["cat"]>("trailer");
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {TRANSITION_CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
              cat === c.id ? CAT_STYLE[c.id] : "border-zinc-700 bg-zinc-950 text-zinc-400"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {TRANSITIONS.filter((t) => t.cat === cat).map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              title={t.desc}
              onClick={() => onPick(t.id)}
              className={`text-left rounded-md border px-2 py-1.5 transition-colors disabled:opacity-50 ${
                on
                  ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100 shadow-[0_0_12px_-4px_rgba(34,211,238,0.6)]"
                  : "border-zinc-700/70 bg-zinc-950 text-zinc-300 hover:border-cyan-300/40"
              }`}
            >
              <span className="block text-[11px] font-semibold leading-tight">{t.name}</span>
              <span className="block truncate text-[10px] text-zinc-500">{t.desc}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function SettingsPanel({
  settings: s,
  onChange,
  hasVideo,
  videoWidth = 0,
  videoHeight = 0,
  videoUrl = null,
  videoDuration = 0,
}: SettingsPanelProps) {
  const setEl =
    (key: "title" | "label" | "desc") =>
    (patch: Partial<TextElement>) => {
      onChange({ [key]: { ...s[key], ...patch } } as Partial<Settings>);
    };
  const setSize =
    (key: "title" | "label" | "desc") =>
    (v: number[]) => {
      onChange({ [key]: { ...s[key], size: v[0] } } as Partial<Settings>);
    };

  const disabled = !hasVideo;
  const [tab, setTab] = useState<SettingsTab>("video");

  // ===== v1.3.5: ZOOM & GESER BEBAS 4 ARAH (port dari NOVACUT Studio) =====
  const PAN_STEP = 0.02; // 2% per tekan panah, konsisten dgn nudge teks
  const nudgePan = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) {
      // tombol tengah = tengahkan kembali
      onChange({ panX: 0.5, panY: 0.5 });
      return;
    }
    onChange({
      panX: Math.min(1, Math.max(0, Number((s.panX + dx).toFixed(3)))),
      panY: Math.min(1, Math.max(0, Number((s.panY + dy).toFixed(3)))),
    });
  };
  const resetFraming = () => onChange({ zoom: 1, panX: 0.5, panY: 0.5 });
  /** ISI FRAME — hitung zoom otomatis sampai bar hitam hilang (mode video utuh) */
  const isiFrame = () => {
    if (!videoWidth || !videoHeight) return;
    const sc = Math.min(1080 / videoWidth, 1920 / videoHeight);
    const fill = Math.max(1080 / (videoWidth * sc), 1920 / (videoHeight * sc));
    const z = Math.min(5, Math.max(1, Math.ceil(fill * 100) / 100));
    onChange({ zoom: z, panX: 0.5, panY: 0.5 });
  };
  const isiZoom =
    s.ratio === "fit" && videoWidth > 0 && videoHeight > 0
      ? (() => {
          const sc = Math.min(1080 / videoWidth, 1920 / videoHeight);
          const fill = Math.max(1080 / (videoWidth * sc), 1920 / (videoHeight * sc));
          return Math.min(5, Math.max(1, Math.ceil(fill * 100) / 100));
        })()
      : null;

  // ===== v1.3.5: EFEK ala NOVACUT =====
  const toggleEffect = (id: string) => {
    const list = s.effects.includes(id) ? s.effects.filter((x) => x !== id) : [...s.effects, id];
    onChange({ effects: list });
  };
  const activeTransition = s.transitionType ? getTransition(s.transitionType) : null;

  // ===== v1.3.5: COVER ala NOVACUT =====
  const coverTpl = getCoverTemplate(s.coverTemplate);
  const coverTitle = s.title.text.trim() || "Judul Video";
  const [showAllTpl, setShowAllTpl] = useState(false);
  const [coverBgFrame, setCoverBgFrame] = useState<string | null>(null);
  const [coverBright, setCoverBright] = useState(128);
  const [coverBusy, setCoverBusy] = useState(false);
  const cvPreviewRef = useRef<HTMLCanvasElement>(null);
  const tplGridRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const coverUploadRef = useRef<HTMLInputElement>(null);

  const recommendedTpl = aiRecommendTemplates(coverTitle, coverBright, 6);

  // ambil frame video utk pratinjau cover (waktu frame mengikuti aturan server)
  useEffect(() => {
    let alive = true;
    const grab = async () => {
      if (!videoUrl || s.coverBg === "hitam" || s.coverMode === "manual") {
        if (alive) setCoverBgFrame(null);
        return;
      }
      const t = s.coverSame
        ? Math.min(1, videoDuration * 0.08)
        : videoDuration * (s.coverPos === "tengah" ? 0.5 : 0.12);
      if (alive) setCoverBusy(true);
      const u = await grabFrame(videoUrl, Math.max(0.05, t), 540);
      if (!alive) return;
      setCoverBgFrame(u);
      setCoverBusy(false);
      if (u) {
        const im = new Image();
        im.onload = () => setCoverBright(sampleBrightness(im));
        im.src = u;
      }
    };
    void grab();
    return () => {
      alive = false;
    };
  }, [videoUrl, videoDuration, s.coverBg, s.coverMode, s.coverPos, s.coverSame]);

  // pastikan font bundel siap sebelum menggambar kanvas cover
  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts) {
      FONT_OPTIONS.forEach((f) => {
        void document.fonts.load(`${f.weight} 40px "${f.css}"`);
      });
    }
  }, []);

  // render pratinjau cover
  useEffect(() => {
    const c = cvPreviewRef.current;
    if (!c || !coverTpl) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const paint = (img: CanvasImageSource | null) => {
      renderCoverCanvas(ctx, {
        template: coverTpl,
        title: coverTitle,
        part: labelTextFor(s, 1),
        bgMode: s.coverBg === "hitam" ? "black" : "img",
        bgImg: img,
        frame: s.coverFrameStyle,
        manualPlain: s.coverMode === "manual" && s.coverManualPlain,
        withBadge: true,
        w: c.width,
        h: c.height,
      });
    };
    if (s.coverMode === "manual" && s.coverImage) {
      void loadImage(s.coverImage).then(paint).catch(() => paint(null));
    } else if (coverBgFrame) {
      void loadImage(coverBgFrame).then(paint).catch(() => paint(null));
    } else {
      paint(null);
    }
    // `tab` di dependensi: kanvas baru terpasang saat tab COVER dibuka,
    // jadi pratinjau harus digambar ulang pada pergantian tab.
  }, [coverTpl, coverTitle, coverBgFrame, s, tab]);

  // render thumbnail 100 template (sekali saat grid dibuka)
  useEffect(() => {
    if (!showAllTpl) return;
    const t = setTimeout(() => {
      tplGridRefs.current.forEach((c, i) => {
        if (!c || c.dataset.done === "1") return;
        const ctx = c.getContext("2d");
        const tpl = COVER_TEMPLATES[i];
        if (!ctx || !tpl) return;
        renderCoverCanvas(ctx, {
          template: tpl,
          title: coverTitle.slice(0, 22),
          bgMode: s.coverBg === "hitam" ? "black" : "img",
          bgImg: null,
          frame: "none",
          withBadge: false,
          w: c.width,
          h: c.height,
        });
        c.dataset.done = "1";
      });
    }, 60);
    return () => clearTimeout(t);
  }, [showAllTpl, coverTitle, s.coverBg]);

  const pickCoverFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    if (f.size > 5 * 1024 * 1024) return; // batas 5 MB
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ coverMode: "manual", coverImage: String(reader.result ?? "") });
    };
    reader.readAsDataURL(f);
  };

  // v1.3.5: dialog folder & setelan ekspor kini ada di panel EKSPORT & SPLIT ala NOVACUT

  /** pilihan font dengan contoh tulisan memakai font aslinya */
  const fontSelect = (
    key: "title" | "label" | "desc",
    el: TextElement
  ) => (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-zinc-400 shrink-0">Font</Label>
      <Select
        value={el.font}
        disabled={disabled}
        onValueChange={(v) => setEl(key)({ font: v as FontKey })}
      >
        <SelectTrigger className="h-8 flex-1 bg-zinc-950 border-zinc-700 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((f) => (
            <SelectItem key={f.key} value={f.key} style={{ fontFamily: `"${f.css}", sans-serif` }}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const tabBtn = (active: boolean) =>
    `h-8 rounded-lg font-display text-[10px] font-bold tracking-[0.1em] uppercase flex items-center justify-center gap-1 transition-all ${
      active
        ? "bg-gradient-to-r from-cyan-500/85 to-indigo-500/85 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.4)]"
        : "text-zinc-400 hover:text-cyan-200 hover:bg-cyan-400/5"
    }`;

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* ===== TAB PILIHAN — 5 menu utama (v1.3.5) ===== */}
      <div
        role="tablist"
        aria-label="Kelompok pengaturan"
        className="shrink-0 grid grid-cols-5 gap-1 rounded-xl border border-cyan-300/20 bg-slate-950/60 p-1"
      >
        {(
          [
            { key: "video", label: "Video", icon: <Scissors className="w-3.5 h-3.5" /> },
            { key: "teks", label: "Teks", icon: <Type className="w-3.5 h-3.5" /> },
            { key: "gaya", label: "Gaya", icon: <Palette className="w-3.5 h-3.5" /> },
            { key: "efek", label: "Efek", icon: <Sparkles className="w-3.5 h-3.5" /> },
            { key: "cover", label: "Cover", icon: <ImageIcon className="w-3.5 h-3.5" /> },
          ] as Array<{ key: SettingsTab; label: string; icon: React.ReactNode }>
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={tabBtn(tab === t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto kolosal-scroll lg:pr-1 flex flex-col gap-3 pb-1">
      {tab === "video" && (
      <>
      {/* v1.3.5: menu PEMOTONGAN, PARALEL, KUALITAS & FOLDER pindah ke panel
          EKSPORT & SPLIT ala NOVACUT di bawah panel ini */}

      {/* ===== RASIO & ZOOM — ZOOM & GESER ala NOVACUT (v1.3.5) ===== */}
      <Section num="01" icon={<Proportions className="w-4 h-4" />} title="Rasio & Zoom">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            disabled={disabled}
            variant={s.ratio === "full" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.ratio === "full" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
            onClick={() => onChange({ ratio: "full" })}
          >
            9:16 Penuh
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            variant={s.ratio === "fit" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.ratio === "fit" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
            onClick={() => onChange({ ratio: "fit" })}
          >
            9:16 Biasa + Blur
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Zoom</Label>
          <Slider
            value={[s.zoom]}
            min={1}
            max={5}
            step={0.05}
            disabled={disabled}
            onValueChange={(v) => onChange({ zoom: v[0] })}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-8">
            {s.zoom.toFixed(2)}×
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <PanPad onNudge={nudgePan} disabled={disabled} />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Move className="w-3.5 h-3.5 text-cyan-300 shrink-0" aria-hidden />
              <span className="tabular-nums">
                X {Math.round(s.panX * 100)}% · Y {Math.round(s.panY * 100)}%
              </span>
              <span className="text-zinc-600">(0 = kiri/atas · 100 = kanan/bawah)</span>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || isiZoom === null}
                title={isiZoom !== null ? `Set zoom ${isiZoom.toFixed(2)}× agar bar hitam hilang` : "Aktif pada mode 9:16 Biasa"}
                className="h-7 px-2 text-[11px] border-emerald-300/40 text-emerald-200 hover:bg-emerald-400/10 hover:border-emerald-300/70 disabled:opacity-40"
                onClick={isiFrame}
              >
                <Expand className="w-3.5 h-3.5 mr-1" aria-hidden />
                ISI FRAME{isiZoom !== null ? ` (${isiZoom.toFixed(2)}×)` : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                className="h-7 px-2 text-[11px] border-zinc-700 text-zinc-300 hover:text-red-300 hover:border-red-400/50"
                onClick={resetFraming}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" aria-hidden />
                RESET
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-snug">
              {s.ratio === "full"
                ? "Video memenuhi layar 9:16. Zoom 1–5×, lalu geser panah untuk memilih bagian video yang diambil (kiri–kanan, atas–bawah)."
                : "Video utuh di atas latar blur. Zoom & geser untuk memperbesar bagian tertentu — pakai ISI FRAME agar bar hitam hilang."}
            </p>
          </div>
        </div>
      </Section>

      {/* ===== TEKS OTOMATIS (v1.3.3) ===== */}
      <Section num="02" icon={<Captions className="w-4 h-4" />} title="Teks Otomatis (Suara → Teks)">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="subtitle-on" className="text-xs text-zinc-300">
            Buat teks dari suara video ini
          </Label>
          <Switch
            id="subtitle-on"
            checked={s.subtitle.enabled}
            disabled={disabled}
            onCheckedChange={(v) =>
              onChange({ subtitle: { ...s.subtitle, enabled: v } })
            }
          />
        </div>
        {s.subtitle.enabled ? (
          <>
            <p className="text-[11px] leading-snug text-emerald-200/80">
              Setiap ucapan di video otomatis jadi teks yang menempel pas dengan suaranya
              (Bahasa Indonesia — resmi &amp; slang, berjalan offline).
            </p>
            <div>
              <p className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase mb-1.5">
                Kecepatan membaca suara
              </p>
              <div className="flex gap-1.5">
                {SUB_MODE_KEYS.map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    disabled={disabled}
                    variant={s.subtitle.mode === k ? "default" : "outline"}
                    className={`h-8 flex-1 text-[10px] px-1 ${
                      s.subtitle.mode === k
                        ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                        : "border-zinc-700 text-zinc-300"
                    }`}
                    onClick={() =>
                      onChange({ subtitle: { ...s.subtitle, mode: k as SubMode } })
                    }
                  >
                    {SUB_MODES_INFO[k].label.toUpperCase()}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug">
                {SUB_MODES_INFO[s.subtitle.mode].desc}
              </p>
            </div>
            <div>
              <p className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase mb-1.5">
                Gaya teks di video
              </p>
              <div className="flex gap-1.5">
                {SUB_STYLE_KEYS.map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    disabled={disabled}
                    variant={s.subtitle.style === k ? "default" : "outline"}
                    className={`h-8 flex-1 text-[10px] px-1 ${
                      s.subtitle.style === k
                        ? "bg-amber-300 text-slate-950 hover:bg-amber-200 font-semibold shadow-[0_0_16px_rgba(252,211,77,0.3)]"
                        : "border-zinc-700 text-zinc-300"
                    }`}
                    onClick={() =>
                      onChange({ subtitle: { ...s.subtitle, style: k as SubStyle } })
                    }
                  >
                    {SUB_STYLES_INFO[k].label.toUpperCase()}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug">
                {SUB_STYLES_INFO[s.subtitle.style].desc}
              </p>
            </div>
            {/* v1.3.4: slider posisi vertikal teks (naik turun) */}
            <div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-zinc-400 shrink-0">Posisi Teks</Label>
                <Slider
                  value={[s.subtitle.posY]}
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  disabled={disabled}
                  onValueChange={(v) =>
                    onChange({ subtitle: { ...s.subtitle, posY: v[0] } })
                  }
                  className="flex-1"
                />
                <span className="text-[11px] text-zinc-500 tabular-nums w-9">
                  {Math.round(s.subtitle.posY * 100)}%
                </span>
              </div>
              <div
                className="flex justify-between font-tech text-[9px] tracking-[0.18em] text-zinc-600 px-1 mt-0.5"
                aria-hidden
              >
                <span>▲ ATAS</span>
                <span>TENGAH</span>
                <span>BAWAH ▼</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                Geser untuk menaikkan atau menurunkan posisi teks di video.
              </p>
            </div>
            <p className="text-[11px] text-zinc-600 leading-snug">
              Video panjang cukup dibaca sekali — semua bagian otomatis dapat teksnya.
              Video tanpa suara dilewati otomatis.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-zinc-500 leading-snug">
            Mati — video dirender tanpa teks otomatis. Aktifkan agar setiap ucapan langsung
            tampil sebagai teks yang sinkron dengan suaranya.
          </p>
        )}
      </Section>
      </>
      )}
      {tab === "teks" && (
      <>
        <p className="text-[11px] text-cyan-100/60 leading-snug rounded-lg border border-cyan-300/15 bg-cyan-400/5 px-3 py-2">
          Tips: posisi tiap teks bisa digeser langsung dengan menyeretnya di pratinjau, atau pakai
          pad mini & tombol panah di bawah tiap teks.
        </p>

      {/* ===== JUDUL ===== */}
      <Section num="01" icon={<Type className="w-4 h-4" />} title="Judul Video (dari nama file)">
        <div className="flex items-center justify-between">
          <Label htmlFor="title-on" className="text-xs text-zinc-300">
            Tampilkan judul
          </Label>
          <Switch
            id="title-on"
            checked={s.title.enabled}
            onCheckedChange={(v) => onChange({ title: { ...s.title, enabled: v } })}
          />
        </div>
        <Input
          value={s.title.text}
          disabled={disabled}
          onChange={(e) => onChange({ title: { ...s.title, text: e.target.value } })}
          placeholder="Isi otomatis dari nama file..."
          className="h-9 bg-zinc-950 border-zinc-700 text-sm"
        />
        {fontSelect("title", s.title)}
        <PositionPad el={s.title} onChange={setEl("title")} disabled={disabled} />
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Ukuran</Label>
          <Slider
            value={[s.title.size]}
            min={24}
            max={120}
            step={2}
            disabled={disabled}
            onValueChange={setSize("title")}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-7">{s.title.size}px</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Judul ini juga dipakai otomatis sebagai tulisan di cover (menu COVER).
        </p>
      </Section>

      {/* ===== LABEL BAGIAN ===== */}
      <Section num="02" icon={<Hash className="w-4 h-4" />} title="Label Part / Bagian / Eps">
        <div className="flex items-center justify-between">
          <Label htmlFor="label-on" className="text-xs text-zinc-300">
            Tampilkan label urutan
          </Label>
          <Switch
            id="label-on"
            checked={s.label.enabled}
            onCheckedChange={(v) => onChange({ label: { ...s.label, enabled: v } })}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={s.label.format}
            disabled={disabled}
            onValueChange={(v) => onChange({ label: { ...s.label, format: v as LabelFormat } })}
          >
            <SelectTrigger className="h-9 flex-1 bg-zinc-950 border-zinc-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="part">Part 1, Part 2, ...</SelectItem>
              <SelectItem value="bagian">Bagian 1, Bagian 2, ...</SelectItem>
              <SelectItem value="eps">EPS 1, EPS 2, ...</SelectItem>
              <SelectItem value="episode">Episode 1, Episode 2, ...</SelectItem>
              <SelectItem value="custom">Kustom...</SelectItem>
            </SelectContent>
          </Select>
          {s.label.format === "custom" && (
            <Input
              value={s.label.prefix}
              disabled={disabled}
              onChange={(e) => onChange({ label: { ...s.label, prefix: e.target.value } })}
              placeholder="BAGIAN KE-{n}"
              className="h-9 w-[130px] bg-zinc-950 border-zinc-700 text-sm"
            />
          )}
        </div>
        <PositionPad el={s.label} onChange={setEl("label")} disabled={disabled} />
        {fontSelect("label", s.label)}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Ukuran</Label>
          <Slider
            value={[s.label.size]}
            min={24}
            max={120}
            step={2}
            disabled={disabled}
            onValueChange={setSize("label")}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-7">{s.label.size}px</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Label ini juga otomatis tertulis di cover tiap bagian (ala NOVACUT).
        </p>
      </Section>

      {/* ===== DESKRIPSI ===== */}
      <Section num="03" icon={<MessageSquare className="w-4 h-4" />} title="Deskripsi dalam Video">
        <div className="flex items-center justify-between">
          <Label htmlFor="desc-on" className="text-xs text-zinc-300">
            Tampilkan deskripsi
          </Label>
          <Switch
            id="desc-on"
            checked={s.desc.enabled}
            onCheckedChange={(v) => onChange({ desc: { ...s.desc, enabled: v } })}
          />
        </div>
        <Textarea
          value={s.desc.text}
          disabled={disabled}
          onChange={(e) => onChange({ desc: { ...s.desc, text: e.target.value } })}
          placeholder="Tulis keterangan / deskripsi yang muncul di dalam video... (maks 6 baris)"
          rows={3}
          className="bg-zinc-950 border-zinc-700 text-sm resize-none"
        />
        <PositionPad el={s.desc} onChange={setEl("desc")} disabled={disabled} />
        {fontSelect("desc", s.desc)}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Ukuran</Label>
          <Slider
            value={[s.desc.size]}
            min={24}
            max={120}
            step={2}
            disabled={disabled}
            onValueChange={setSize("desc")}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-7">{s.desc.size}px</span>
        </div>
      </Section>
      </>
      )}

      {tab === "gaya" && (
      <>

      {/* ===== GAYA FRAME ===== */}
      <Section num="01" icon={<Layers className="w-4 h-4" />} title="Gaya Frame Film">
        <div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto kolosal-scroll pr-1">
          {FRAME_STYLES.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ frame: p.key, bars: p.defBars })}
              className={`text-left rounded-lg border p-2 flex gap-2 items-center transition-colors disabled:opacity-50 ${
                s.frame === p.key
                  ? "border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_14px_-4px_rgba(34,211,238,0.6)]"
                  : "border-zinc-700/70 bg-zinc-950 hover:border-zinc-500"
              }`}
            >
              <span className="shrink-0 relative w-[30px] h-[53px] rounded-md overflow-hidden bg-black border border-zinc-700 flex items-center justify-center">
                {p.preview ? (
                  <img
                    src={p.preview}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-[8px] text-zinc-500 font-tech">OFF</span>
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[11px] font-semibold leading-tight ${
                    s.frame === p.key ? "text-cyan-200" : "text-zinc-200"
                  }`}
                >
                  {p.name}
                </span>
                <span className="block text-[10px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">
                  {p.tagline}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Frame neon berputar beranimasi pada hasil ekspor (pratinjau menampilkan animasi asli).
        </p>
        <Separator className="bg-zinc-800" />
        <div className="flex items-center justify-between">
          <Label htmlFor="bars-on" className="text-xs text-zinc-300">
            Bar sinema (hitam atas-bawah)
          </Label>
          <Switch
            id="bars-on"
            checked={s.bars}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ bars: v })}
          />
        </div>
        {s.bars && (
          <div className="flex gap-1.5">
            {(["kecil", "sedang", "besar"] as const).map((b) => (
              <Button
                key={b}
                size="sm"
                disabled={disabled}
                variant={s.barSize === b ? "default" : "outline"}
                className={`h-7 flex-1 text-xs capitalize ${s.barSize === b ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
                onClick={() => onChange({ barSize: b })}
              >
                {b}
              </Button>
            ))}
          </div>
        )}
      </Section>
      </>
      )}

      {tab === "efek" && (
      <>
        {/* ===== TRANSISI MASUK (28, ala NOVACUT) ===== */}
        <Section num="01" icon={<Zap className="w-4 h-4" />} title="Transisi Masuk Tiap Bagian">
          <TransitionPicker
            active={s.transitionType}
            onPick={(id) => onChange({ transitionType: id, transitionDur: s.transitionDur || 0.6 })}
            disabled={disabled}
          />
          {activeTransition && (
            <>
              <div className="flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-400/[0.07] px-2 py-1.5">
                <span className="flex-1 truncate text-[11px] text-cyan-100">
                  {activeTransition.name}
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={s.transitionDur}
                  onChange={(e) => onChange({ transitionDur: Number(e.target.value) })}
                  className="h-1 w-20 accent-cyan-400"
                  aria-label="Durasi transisi"
                />
                <span className="w-8 text-right font-mono text-[11px] text-cyan-300">
                  {s.transitionDur.toFixed(1)}s
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] text-red-300 hover:bg-red-500/10"
                  onClick={() => onChange({ transitionType: null })}
                >
                  Hapus
                </Button>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Transisi tampil di awal setiap bagian — paling terlihat saat perginya dari cover
                ke video. {activeTransition.desc}.
              </p>
            </>
          )}
          {!activeTransition && (
            <p className="text-[11px] text-zinc-500 leading-snug">
              Mati — bagian langsung dimulai tanpa animasi pembuka. Pilih salah satu transisi di
              atas untuk memberi sentuhan pembuka ala trailer/iklan.
            </p>
          )}
        </Section>

        {/* ===== EFEK BLOCKBUSTER (20, ala NOVACUT) ===== */}
        <Section num="02" icon={<Sparkles className="w-4 h-4" />} title="Efek Blockbuster">
          {(["grade", "fx"] as const).map((group) => (
            <div key={group} className="space-y-1">
              <div className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase">
                {group === "grade" ? "Color Grading" : "Efek Visual"}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CLIP_EFFECTS.filter((e) => e.group === group).map((e) => {
                  const active = s.effects.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      disabled={disabled}
                      title={e.desc}
                      onClick={() => toggleEffect(e.id)}
                      className={`text-left rounded-md border px-2 py-1.5 transition-colors disabled:opacity-50 ${
                        active
                          ? "border-emerald-300/70 bg-emerald-400/15 text-emerald-100 shadow-[0_0_12px_-4px_rgba(52,211,153,0.6)]"
                          : "border-zinc-700/70 bg-zinc-950 text-zinc-300 hover:border-emerald-400/40"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold leading-tight">{e.name}</span>
                      <span className="block truncate text-[10px] text-zinc-500">{e.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {s.effects.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-red-300 hover:bg-red-500/10 w-fit"
              onClick={() => onChange({ effects: [] })}
            >
              <Eraser className="h-3 w-3" /> Bersihkan ({s.effects.length} aktif)
            </Button>
          )}
          <p className="text-[11px] text-zinc-500 leading-snug">
            Efek berlaku pada seluruh isi setiap bagian (termasuk di pratinjau). Bisa dipadukan —
            misalnya Teal &amp; Orange + Vignette + Film Grain.
          </p>
        </Section>

        {/* ===== KECEPATAN & ULANG ===== */}
        <Section num="03" icon={<Gauge className="w-4 h-4" />} title="Kecepatan & Ulang">
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="w-12 shrink-0">Speed</span>
            <Slider
              value={[s.speed]}
              min={0.25}
              max={4}
              step={0.25}
              disabled={disabled}
              onValueChange={(v) => onChange({ speed: v[0] })}
              className="flex-1"
            />
            <span className="w-10 text-right font-mono text-cyan-300">{s.speed}x</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="w-12 shrink-0">Ulang</span>
            <Slider
              value={[s.loopCount]}
              min={1}
              max={10}
              step={1}
              disabled={disabled}
              onValueChange={(v) => onChange({ loopCount: v[0] })}
              className="flex-1"
            />
            <span className="w-10 text-right font-mono text-cyan-300">{s.loopCount}×</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-snug">
            Perlambat (0.25×) untuk slow-motion sinematik, percepat untuk time-lapse.
            &quot;Ulang&quot; memutar ulang isi bagian berkali-kali — teks &amp; efek ikut
            terulang. {s.speed !== 1 ? `Durasi tiap bagian berubah ±${(1 / s.speed).toFixed(2)}×.` : ""}
          </p>
        </Section>
      </>
      )}

      {tab === "cover" && (
      <>
        <Section num="01" icon={<Wand2 className="w-4 h-4" />} title="Cover Studio (ala NOVACUT)">
          <div className="flex items-center justify-between">
            <Label htmlFor="cover-on" className="text-xs text-zinc-300">
              Tambahkan cover otomatis
            </Label>
            <Switch
              id="cover-on"
              checked={s.coverEnabled}
              disabled={disabled}
              onCheckedChange={(v) => onChange({ coverEnabled: v })}
            />
          </div>

          {s.coverEnabled && (
            <>
              {/* pratinjau cover langsung */}
              <div className="flex gap-3 items-start">
                <div className="shrink-0 overflow-hidden rounded-lg border border-cyan-300/25 bg-black shadow-[0_0_18px_-6px_rgba(34,211,238,0.5)]">
                  <canvas ref={cvPreviewRef} width={189} height={336} className="block" />
                </div>
                <div className="min-w-0 flex-1 text-[11px] text-zinc-500 leading-snug">
                  <p className="text-cyan-200/90 font-semibold mb-1">Pratinjau cover bagian 1</p>
                  <p>
                    Judul diambil dari menu TEKS (otomatis dari nama file), label bagian otomatis
                    &quot;{labelTextFor(s, 1)}&quot;.
                  </p>
                  {coverBusy && <p className="mt-1 text-cyan-300/70">Mengambil frame video…</p>}
                </div>
              </div>

              {/* pilih gaya template */}
              <div className="space-y-1.5">
                <div className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase">
                  Gaya Cover — 100 Template
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ coverTemplate: "legacy" })}
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors disabled:opacity-50 ${
                    s.coverTemplate === "legacy"
                      ? "border-cyan-300/60 bg-cyan-400/10"
                      : "border-zinc-700/70 bg-zinc-950 hover:border-zinc-500"
                  }`}
                >
                  <span className="block text-[11px] font-semibold text-zinc-200">
                    Klasik KolosalCut (teks judul sederhana)
                  </span>
                  <span className="block text-[10px] text-zinc-500">
                    Cover lama: frame video + tulisan judul/label + frame neon
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  {recommendedTpl.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ coverTemplate: t.id })}
                      title={t.name}
                      className={`truncate rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors disabled:opacity-50 ${
                        t.id === s.coverTemplate
                          ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-100"
                          : "border-zinc-700/70 bg-zinc-950 text-zinc-300 hover:border-cyan-300/40"
                      }`}
                    >
                      <Sparkles className="inline w-3 h-3 mr-1 text-cyan-300/80" aria-hidden />
                      {t.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded-md border border-zinc-700/70 bg-zinc-950 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:border-zinc-500"
                  onClick={() => setShowAllTpl((v) => !v)}
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-cyan-400" />
                  SEMUA TEMPLATE ({COVER_TEMPLATES.length}) {showAllTpl ? "▲" : "▼"}
                </button>
                {showAllTpl && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[280px] overflow-y-auto kolosal-scroll pr-1">
                    {COVER_TEMPLATES.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={disabled}
                        title={t.name}
                        onClick={() => onChange({ coverTemplate: t.id })}
                        className={`overflow-hidden rounded-md border text-left transition-transform hover:scale-[1.04] disabled:opacity-50 ${
                          t.id === s.coverTemplate
                            ? "border-cyan-300 ring-1 ring-cyan-300/60"
                            : t.popular
                              ? "border-amber-400/40"
                              : "border-zinc-700/70"
                        }`}
                      >
                        <canvas
                          ref={(el) => {
                            tplGridRefs.current[i] = el;
                          }}
                          width={72}
                          height={128}
                          className="w-full block"
                        />
                        <div className="flex items-center gap-1 bg-black/60 px-1 py-0.5">
                          {t.id === s.coverTemplate && (
                            <Check className="h-2.5 w-2.5 shrink-0 text-cyan-300" />
                          )}
                          <span className="truncate text-[9px] text-zinc-300">{t.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* sumber cover */}
              <div className="space-y-1.5">
                <div className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase">
                  Sumber Cover
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    disabled={disabled}
                    variant={s.coverMode === "auto" ? "default" : "outline"}
                    className={`h-8 text-xs ${s.coverMode === "auto" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                    onClick={() => onChange({ coverMode: "auto" })}
                  >
                    Otomatis dari Video
                  </Button>
                  <Button
                    size="sm"
                    disabled={disabled}
                    variant={s.coverMode === "manual" ? "default" : "outline"}
                    className={`h-8 text-xs ${s.coverMode === "manual" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                    onClick={() => coverUploadRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" aria-hidden />
                    Unggah Sendiri
                  </Button>
                </div>
                <input
                  ref={coverUploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    pickCoverFile(e.target.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
                {s.coverMode === "manual" && (
                  <>
                    <p className="text-[11px] text-zinc-500 leading-snug">
                      {s.coverImage
                        ? "Gambar unggahan siap dipakai sebagai latar semua cover (maks 5 MB)."
                        : "Klik Unggah Sendiri lalu pilih file PNG/JPG (maks 5 MB)."}
                    </p>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={s.coverManualPlain}
                        disabled={disabled}
                        onChange={(e) => onChange({ coverManualPlain: e.target.checked })}
                        className="h-3.5 w-3.5 accent-cyan-400"
                      />
                      Gambar apa adanya — tanpa teks judul &amp; part
                    </label>
                  </>
                )}
              </div>

              {/* latar cover (mode otomatis) */}
              {s.coverMode === "auto" && (
                <div className="space-y-1.5">
                  <div className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase">
                    Latar Cover
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      disabled={disabled}
                      variant={s.coverBg === "adegan" ? "default" : "outline"}
                      className={`h-8 text-xs ${s.coverBg === "adegan" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                      onClick={() => onChange({ coverBg: "adegan" })}
                    >
                      Adegan dari Video
                    </Button>
                    <Button
                      size="sm"
                      disabled={disabled}
                      variant={s.coverBg === "hitam" ? "default" : "outline"}
                      className={`h-8 text-xs ${s.coverBg === "hitam" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                      onClick={() => onChange({ coverBg: "hitam" })}
                    >
                      Hitam Polos
                    </Button>
                  </div>
                  {s.coverBg === "adegan" ? (
                    <>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          size="sm"
                          disabled={disabled}
                          variant={!s.coverSame ? "default" : "outline"}
                          className={`h-8 text-xs ${!s.coverSame ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                          onClick={() => onChange({ coverSame: false })}
                        >
                          Tiap Bagian Beda
                        </Button>
                        <Button
                          size="sm"
                          disabled={disabled}
                          variant={s.coverSame ? "default" : "outline"}
                          className={`h-8 text-xs ${s.coverSame ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                          onClick={() => onChange({ coverSame: true })}
                        >
                          Semua Bagian Sama
                        </Button>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">
                        {s.coverSame
                          ? "Semua bagian memakai 1 adegan yang sama (awal video)."
                          : "Setiap bagian memakai adegan dari segmennya sendiri."}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-zinc-500 leading-snug">
                      Latar hitam polos dengan tulisan judul — seperti gaya trailer klasik.
                    </p>
                  )}
                </div>
              )}

              {/* bingkai cover */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-tech text-[9px] tracking-[0.18em] text-zinc-500 uppercase">
                    Bingkai Cover
                  </div>
                  <span className="font-mono text-[9px] text-cyan-300/70">transparan 75%</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {COVER_FRAME_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={disabled}
                      title={f.desc}
                      onClick={() => onChange({ coverFrameStyle: f.id as CoverFrameStyle })}
                      className={`rounded-md border px-2 py-1.5 text-left transition-colors disabled:opacity-50 ${
                        s.coverFrameStyle === f.id
                          ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-100"
                          : "border-zinc-700/70 bg-zinc-950 text-zinc-300 hover:border-cyan-300/40"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold leading-tight">{f.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 leading-snug">
                  {COVER_FRAME_OPTIONS.find((f) => f.id === s.coverFrameStyle)?.desc}
                </p>
              </div>

              {/* durasi & posisi frame */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400">Posisi frame cover</Label>
                <Select
                  value={s.coverPos}
                  disabled={disabled}
                  onValueChange={(v) => onChange({ coverPos: v as "awal" | "tengah" })}
                >
                  <SelectTrigger className="h-8 w-[150px] bg-zinc-950 border-zinc-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awal">Awal bagian</SelectItem>
                    <SelectItem value="tengah">Tengah bagian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-zinc-400 shrink-0">Durasi</Label>
                <Slider
                  value={[s.coverDuration]}
                  min={1}
                  max={5}
                  step={0.5}
                  disabled={disabled}
                  onValueChange={(v) => onChange({ coverDuration: v[0] })}
                  className="flex-1"
                />
                <span className="text-[11px] text-zinc-500 tabular-nums w-10">
                  {s.coverDuration.toFixed(1)}s
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                {coverTpl
                  ? `Template aktif: ${coverTpl.name}. Cover tampil ${s.coverDuration.toFixed(1)} detik di awal setiap bagian hasil render.`
                  : "Cover tampil di awal setiap bagian hasil render."}
              </p>
            </>
          )}
        </Section>
      </>
      )}
      </div>
    </div>
  );
}
