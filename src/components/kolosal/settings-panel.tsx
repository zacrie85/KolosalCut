"use client";

import { Settings, TextZone, LabelFormat, FRAME_PRESETS, QUALITY_INFO, QualityKey } from "@/lib/video-config";
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
import { Scissors, Image as ImageIcon, Type, Hash, MessageSquare, Palette, Proportions, Gauge } from "lucide-react";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  hasVideo: boolean;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="text-amber-400">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function ZonePicker({
  value,
  onChange,
  disabled,
}: {
  value: TextZone;
  onChange: (z: TextZone) => void;
  disabled?: boolean;
}) {
  const opts: Array<{ v: TextZone; l: string }> = [
    { v: "top", l: "Atas" },
    { v: "center", l: "Tengah" },
    { v: "bottom", l: "Bawah" },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map((o) => (
        <Button
          key={o.v}
          type="button"
          size="sm"
          disabled={disabled}
          variant={value === o.v ? "default" : "outline"}
          className={`h-7 px-3 text-xs flex-1 ${
            value === o.v ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"
          }`}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </Button>
      ))}
    </div>
  );
}

export function SettingsPanel({ settings: s, onChange, hasVideo }: SettingsPanelProps) {
  const setZone = (key: "title" | "label" | "desc") => (z: TextZone) => {
    const el = s[key];
    const y = z === "top" ? 0.055 : z === "center" ? 0.45 : 0.86;
    onChange({ [key]: { ...el, zone: z, relY: y } } as Partial<Settings>);
  };
  const setSize =
    (key: "title" | "label" | "desc") =>
    (v: number[]) => {
      onChange({ [key]: { ...s[key], size: v[0] } } as Partial<Settings>);
    };

  const disabled = !hasVideo;
  const presetObj = FRAME_PRESETS.find((p) => p.key === s.preset);

  return (
    <div className="flex flex-col gap-3">
      {/* ===== PEMOTONGAN ===== */}
      <Section icon={<Scissors className="w-4 h-4" />} title="Pemotongan Video">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            disabled={disabled}
            variant={s.splitMode === "duration" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.splitMode === "duration" ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
            onClick={() => onChange({ splitMode: "duration" })}
          >
            Per Durasi (detik)
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            variant={s.splitMode === "parts" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.splitMode === "parts" ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
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
      <Section icon={<ImageIcon className="w-4 h-4" />} title="Cover Tiap Bagian">
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
                className={`h-8 flex-1 text-xs ${!s.coverSame ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                onClick={() => onChange({ coverSame: false })}
              >
                Cover Berbeda
              </Button>
              <Button
                size="sm"
                disabled={disabled}
                variant={s.coverSame ? "default" : "outline"}
                className={`h-8 flex-1 text-xs ${s.coverSame ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
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
                    className={`h-7 px-3 text-xs ${s.coverDuration === v ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
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

      {/* ===== JUDUL ===== */}
      <Section icon={<Type className="w-4 h-4" />} title="Judul Video (dari nama file)">
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
        <ZonePicker value={s.title.zone} onChange={setZone("title")} disabled={disabled} />
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Ukuran</Label>
          <Slider
            value={[s.title.size]}
            min={30}
            max={90}
            step={2}
            disabled={disabled}
            onValueChange={setSize("title")}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-6">{s.title.size}</span>
        </div>
      </Section>

      {/* ===== LABEL BAGIAN ===== */}
      <Section icon={<Hash className="w-4 h-4" />} title="Label Part / Bagian / Eps">
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
        <ZonePicker value={s.label.zone} onChange={setZone("label")} disabled={disabled} />
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Ukuran</Label>
          <Slider
            value={[s.label.size]}
            min={24}
            max={80}
            step={2}
            disabled={disabled}
            onValueChange={setSize("label")}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-6">{s.label.size}</span>
        </div>
      </Section>

      {/* ===== DESKRIPSI ===== */}
      <Section icon={<MessageSquare className="w-4 h-4" />} title="Deskripsi dalam Video">
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
        <ZonePicker value={s.desc.zone} onChange={setZone("desc")} disabled={disabled} />
        <div className="flex items-center gap-3">
          <Label className="text-xs text-zinc-400 shrink-0">Ukuran</Label>
          <Slider
            value={[s.desc.size]}
            min={24}
            max={70}
            step={2}
            disabled={disabled}
            onValueChange={setSize("desc")}
            className="flex-1"
          />
          <span className="text-[11px] text-zinc-500 tabular-nums w-6">{s.desc.size}</span>
        </div>
      </Section>

      {/* ===== GAYA FILM ===== */}
      <Section icon={<Palette className="w-4 h-4" />} title="Gaya Frame Film">
        <div className="grid grid-cols-1 gap-1.5 max-h-[240px] overflow-y-auto kolosal-scroll pr-1">
          {FRAME_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ preset: p.key, bars: p.defBars })}
              className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
                s.preset === p.key
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-zinc-700/70 bg-zinc-950 hover:border-zinc-500"
              }`}
            >
              <span
                className={`block text-xs font-semibold ${s.preset === p.key ? "text-amber-300" : "text-zinc-200"}`}
              >
                {p.name}
              </span>
              <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">{p.tagline}</span>
            </button>
          ))}
        </div>
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
                className={`h-7 flex-1 text-xs capitalize ${s.barSize === b ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
                onClick={() => onChange({ barSize: b })}
              >
                {b}
              </Button>
            ))}
          </div>
        )}
      </Section>

      {/* ===== RASIO & ZOOM ===== */}
      <Section icon={<Proportions className="w-4 h-4" />} title="Rasio & Zoom">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            disabled={disabled}
            variant={s.ratio === "full" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.ratio === "full" ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
            onClick={() => onChange({ ratio: "full" })}
          >
            9:16 Penuh
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            variant={s.ratio === "fit" ? "default" : "outline"}
            className={`h-8 flex-1 text-xs ${s.ratio === "fit" ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
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

      {/* ===== KUALITAS ===== */}
      <Section icon={<Gauge className="w-4 h-4" />} title="Kualitas Render">
        <div className="flex gap-1.5">
          {(Object.keys(QUALITY_INFO) as QualityKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              disabled={disabled}
              variant={s.quality === k ? "default" : "outline"}
              className={`h-8 flex-1 text-xs ${s.quality === k ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold" : "border-zinc-700 text-zinc-300"}`}
              onClick={() => onChange({ quality: k })}
            >
              {QUALITY_INFO[k].label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">{presetObj ? "" : ""}{QUALITY_INFO[s.quality].desc}</p>
      </Section>
    </div>
  );
}
