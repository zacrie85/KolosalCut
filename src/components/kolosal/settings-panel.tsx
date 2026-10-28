"use client";

import { useEffect, useRef, useState } from "react";
import {
  Settings,
  LabelFormat,
  FRAME_STYLES,
  FONT_OPTIONS,
  PARALLEL_OPTIONS,
  ParallelKey,
  FontKey,
  QUALITY_INFO,
  QualityKey,
  TextElement,
} from "@/lib/video-config";
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
  FolderOpen,
  FolderCheck,
} from "lucide-react";

type SettingsTab = "video" | "teks" | "gaya";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  hasVideo: boolean;
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

export function SettingsPanel({ settings: s, onChange, hasVideo }: SettingsPanelProps) {
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

  // deteksi API desktop (Electron) untuk dialog pilih folder
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(Boolean(window.kolosalAPI?.selectOutputDir));
  }, []);

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

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* ===== TAB PILIHAN — ala panel referensi (Video / Animation / Tracking) ===== */}
      <div
        role="tablist"
        aria-label="Kelompok pengaturan"
        className="shrink-0 grid grid-cols-3 gap-1 rounded-xl border border-cyan-300/20 bg-slate-950/60 p-1"
      >
        {(
          [
            { key: "video", label: "Video", icon: <Scissors className="w-3.5 h-3.5" /> },
            { key: "teks", label: "Teks", icon: <Type className="w-3.5 h-3.5" /> },
            { key: "gaya", label: "Gaya", icon: <Palette className="w-3.5 h-3.5" /> },
          ] as Array<{ key: SettingsTab; label: string; icon: React.ReactNode }>
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`h-8 rounded-lg font-display text-[10px] font-bold tracking-[0.14em] uppercase flex items-center justify-center gap-1.5 transition-all ${
              tab === t.key
                ? "bg-gradient-to-r from-cyan-500/85 to-indigo-500/85 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.4)]"
                : "text-zinc-400 hover:text-cyan-200 hover:bg-cyan-400/5"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto kolosal-scroll lg:pr-1 flex flex-col gap-3 pb-1">
      {tab === "video" && (
      <>
      {/* ===== PEMOTONGAN ===== */}
      <Section num="01" icon={<Scissors className="w-4 h-4" />} title="Pemotongan Video">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            disabled={disabled}
            variant={s.splitMode === "duration" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.splitMode === "duration" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
            onClick={() => onChange({ splitMode: "duration" })}
          >
            Per Durasi (detik)
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            variant={s.splitMode === "parts" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.splitMode === "parts" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
            onClick={() => onChange({ splitMode: "parts" })}
          >
            Per Jumlah Bagian
          </Button>
        </div>
        {s.splitMode === "duration" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="split-sec" className="text-xs text-zinc-400">
              Durasi setiap bagian (detik)
            </Label>
            <div className="flex gap-2">
              <Input
                id="split-sec"
                type="number"
                min={3}
                max={3600}
                value={s.splitSeconds}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ splitSeconds: Math.max(3, Math.min(3600, Number(e.target.value) || 3)) })
                }
                className="h-9 bg-zinc-950 border-zinc-700"
              />
              <div className="flex gap-1">
                {[30, 60, 90].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    className="h-9 px-2 text-xs border-zinc-700 text-zinc-300"
                    onClick={() => onChange({ splitSeconds: v })}
                  >
                    {v}s
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="split-n" className="text-xs text-zinc-400">
              Jumlah bagian yang diinginkan
            </Label>
            <Input
              id="split-n"
              type="number"
              min={1}
              max={50}
              value={s.splitParts}
              disabled={disabled}
              onChange={(e) =>
                onChange({ splitParts: Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))) })
              }
              className="h-9 bg-zinc-950 border-zinc-700"
            />
          </div>
        )}
      </Section>

      {/* ===== COVER ===== */}
      <Section num="02" icon={<ImageIcon className="w-4 h-4" />} title="Cover Tiap Bagian">
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
            <div className="flex gap-1.5">
              <Button
                size="sm"
                disabled={disabled}
                variant={!s.coverSame ? "default" : "outline"}
                className={`h-8 flex-1 text-xs ${!s.coverSame ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
                onClick={() => onChange({ coverSame: false })}
              >
                Cover Berbeda
              </Button>
              <Button
                size="sm"
                disabled={disabled}
                variant={s.coverSame ? "default" : "outline"}
                className={`h-8 flex-1 text-xs ${s.coverSame ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
                onClick={() => onChange({ coverSame: true })}
              >
                Cover Sama Semua
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-zinc-400 shrink-0">Durasi cover:</Label>
              <div className="flex gap-1.5">
                {[2, 3].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    disabled={disabled}
                    variant={s.coverDuration === v ? "default" : "outline"}
                    className={`h-7 px-3 text-xs ${s.coverDuration === v ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
                    onClick={() => onChange({ coverDuration: v })}
                  >
                    {v} detik
                  </Button>
                ))}
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums ml-auto">
                manual: {s.coverDuration.toFixed(1)}s
              </span>
            </div>
            <Slider
              value={[s.coverDuration]}
              min={1}
              max={5}
              step={0.5}
              disabled={disabled}
              onValueChange={(v) => onChange({ coverDuration: v[0] })}
            />
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
            <p className="text-[11px] text-zinc-500 leading-snug">
              {s.coverSame
                ? "Semua cover memakai frame yang sama (awal video), hanya label bagian yang berbeda."
                : "Setiap bagian memakai frame dari segmennya sendiri."}
            </p>
          </>
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
      <Section num="03" icon={<Type className="w-4 h-4" />} title="Judul Video (dari nama file)">
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
      </Section>

      {/* ===== LABEL BAGIAN ===== */}
      <Section num="04" icon={<Hash className="w-4 h-4" />} title="Label Part / Bagian / Eps">
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
      </Section>

      {/* ===== DESKRIPSI ===== */}
      <Section num="05" icon={<MessageSquare className="w-4 h-4" />} title="Deskripsi dalam Video">
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
      <Section num="06" icon={<Layers className="w-4 h-4" />} title="Gaya Frame Film">
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

      {/* ===== RASIO & ZOOM ===== */}
      <Section num="07" icon={<Proportions className="w-4 h-4" />} title="Rasio & Zoom">
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
            max={2.5}
            step={0.05}
            disabled={disabled}
            onValueChange={(v) => onChange({ zoom: v[0] })}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-8">
            {s.zoom.toFixed(2)}×
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          {s.ratio === "full"
            ? "9:16 Penuh: video memenuhi layar (bagian yang tidak muat dipotong)."
            : "9:16 Biasa: video utuh di tengah dengan latar blur; perbesar dengan zoom."}
        </p>
      </Section>
      </>
      )}

      {tab === "video" && (
      <>

      {/* ===== RENDER PARALEL ===== */}
      <Section num="07" icon={<Layers className="w-4 h-4" />} title="Proses Paralel">
        <div className="flex gap-1.5">
          {PARALLEL_OPTIONS.map((n) => (
            <Button
              key={n}
              size="sm"
              disabled={disabled}
              variant={s.parallel === n ? "default" : "outline"}
              className={`h-8 flex-1 text-xs ${
                s.parallel === n
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                  : "border-zinc-700 text-zinc-300"
              }`}
              onClick={() => onChange({ parallel: n as ParallelKey })}
            >
              {n}×
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          {s.parallel === 1
            ? "Satu video dirender pada satu waktu — paling ringan untuk PC lama."
            : `${s.parallel} video dirender serentak dari antrean impor, urutan tetap dari video pertama.`}
        </p>
      </Section>

      {/* ===== KUALITAS ===== */}
      <Section num="08" icon={<Gauge className="w-4 h-4" />} title="Kualitas Render">
        <div className="flex gap-1.5">
          {(Object.keys(QUALITY_INFO) as QualityKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              disabled={disabled}
              variant={s.quality === k ? "default" : "outline"}
              className={`h-8 flex-1 text-xs ${s.quality === k ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold shadow-[0_0_16px_rgba(34,211,238,0.35)]" : "border-zinc-700 text-zinc-300"}`}
              onClick={() => onChange({ quality: k })}
            >
              {QUALITY_INFO[k].label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">{QUALITY_INFO[s.quality].desc}</p>
      </Section>

      {/* ===== FOLDER HASIL RENDER (v1.2.0) ===== */}
      <Section num="09" icon={<FolderOpen className="w-4 h-4" />} title="Folder Hasil Render">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className={`h-8 flex-1 text-xs font-tech tracking-wider ${
              isDesktop
                ? "border-cyan-300/40 text-cyan-200 hover:bg-cyan-400/10 hover:border-cyan-300/60"
                : "border-zinc-700 text-zinc-500"
            }`}
            onClick={pickFolder}
          >
            <FolderOpen className="w-4 h-4 mr-1.5" aria-hidden />
            PILIH FOLDER HASIL…
          </Button>
          {s.outputDir && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-zinc-700 text-zinc-300 hover:text-red-300 hover:border-red-400/50 text-xs"
              onClick={() => onChange({ outputDir: "" })}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden />
              RESET
            </Button>
          )}
        </div>
        <p className="text-[11px] leading-snug break-all">
          {s.outputDir ? (
            <>
              <FolderCheck
                className="inline w-3.5 h-3.5 text-emerald-300 mr-1 -mt-0.5"
                aria-hidden
              />
              <span className="text-emerald-200">Hasil disimpan ke:</span>{" "}
              <span className="text-zinc-300">{s.outputDir}</span>
            </>
          ) : (
            <span className="text-zinc-500">
              Belum dipilih — hasil disimpan ke folder data bawaan aplikasi.
            </span>
          )}
        </p>
        <p className="text-[11px] text-zinc-600 leading-snug">
          Setiap video mendapat subfolder sendiri sesuai judulnya. Tombol pilih folder aktif di
          aplikasi Windows; di pratinjau browser hasil tetap tersimpan di folder bawaan.
        </p>
      </Section>
      </>
      )}
      </div>
    </div>
  );
}
