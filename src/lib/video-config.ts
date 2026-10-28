// ============================================================
// KolosalCut — Konfigurasi bersama (client & server)
// ============================================================

export type SplitMode = "duration" | "parts";
export type TextZone = "top" | "center" | "bottom";
export type LabelFormat = "part" | "bagian" | "eps" | "episode" | "custom";
export type FramePresetKey =
  | "kolosal"
  | "hollywood"
  | "noir"
  | "golden"
  | "modern"
  | "vintage"
  | "none";
export type RatioMode = "full" | "fit";
export type QualityKey = "fast" | "balanced" | "high";
export type BarSize = "kecil" | "sedang" | "besar";

export interface TextElement {
  enabled: boolean;
  text: string;
  zone: TextZone;
  /** posisi horizontal pusat teks 0..1 (diatur lewat drag) */
  relX: number;
  /** posisi vertical atas teks 0..1 (diatur lewat drag) */
  relY: number;
  /** ukuran font pada kanvas 1080px */
  size: number;
}

export interface LabelElement extends TextElement {
  format: LabelFormat;
  /** template kustom, {n} diganti nomor bagian */
  prefix: string;
}

export interface Settings {
  splitMode: SplitMode;
  splitSeconds: number;
  splitParts: number;
  coverEnabled: boolean;
  coverSame: boolean;
  coverDuration: number;
  coverPos: "awal" | "tengah";
  title: TextElement;
  label: LabelElement;
  desc: TextElement;
  preset: FramePresetKey;
  bars: boolean;
  barSize: BarSize;
  ratio: RatioMode;
  zoom: number;
  quality: QualityKey;
}

export const ZONE_Y: Record<TextZone, number> = {
  top: 0.055,
  center: 0.45,
  bottom: 0.86,
};

/** tinggi bar sinema (px pada kanvas 1080x1920) */
export const BAR_H: Record<BarSize, number> = {
  kecil: 150,
  sedang: 235,
  besar: 340,
};

export interface FramePreset {
  key: FramePresetKey;
  name: string;
  tagline: string;
  /** filter CSS untuk pratinjau canvas */
  css: string;
  /** filter ffmpeg untuk render */
  ff: string;
  vignette: boolean;
  grain: number;
  defBars: boolean;
}

export const FRAME_PRESETS: FramePreset[] = [
  {
    key: "kolosal",
    name: "Kolosal Agung",
    tagline: "Nada emas epik + vinyet + bar sinema, gaya film kolosal & bibit",
    css: "contrast(1.12) saturate(0.85) brightness(0.97) sepia(0.18)",
    ff: "eq=contrast=1.12:saturation=0.85:brightness=-0.03,colorbalance=rm=0.07:gm=0.02:bm=-0.06:rh=0.10:bh=-0.08",
    vignette: true,
    grain: 6,
    defBars: true,
  },
  {
    key: "hollywood",
    name: "Hollywood Blockbuster",
    tagline: "Teal & orange khas poster film Hollywood modern",
    css: "contrast(1.18) saturate(1.18)",
    ff: "eq=contrast=1.18:saturation=1.18,colorbalance=bs=0.12:rs=0.06:rh=0.10:gh=-0.02:bh=-0.10",
    vignette: true,
    grain: 4,
    defBars: true,
  },
  {
    key: "noir",
    name: "Noir Klasik",
    tagline: "Hitam-putih kontras tinggi dengan grain film",
    css: "grayscale(1) contrast(1.35) brightness(0.97)",
    ff: "hue=s=0,eq=contrast=1.35:brightness=-0.03",
    vignette: true,
    grain: 9,
    defBars: true,
  },
  {
    key: "golden",
    name: "Golden Hour",
    tagline: "Hangat keemasan lembut, cocok untuk adegan senja",
    css: "contrast(1.08) saturate(1.12) brightness(1.03) sepia(0.12)",
    ff: "eq=contrast=1.08:saturation=1.12:brightness=0.03,colorbalance=rs=0.10:gs=0.04:bs=-0.08:rm=0.05:gm=0.02",
    vignette: true,
    grain: 3,
    defBars: false,
  },
  {
    key: "modern",
    name: "Sinema Modern",
    tagline: "Nada sejuk minimalis + bar sinema rapi",
    css: "contrast(1.10) saturate(0.92)",
    ff: "eq=contrast=1.10:saturation=0.92,colorbalance=bs=0.06:bm=0.02",
    vignette: false,
    grain: 0,
    defBars: true,
  },
  {
    key: "vintage",
    name: "Vintage Film",
    tagline: "Warna pudar + grain, nuansa film jadul 80an",
    css: "contrast(1.05) saturate(0.72) sepia(0.22) brightness(1.02)",
    ff: "eq=contrast=1.05:saturation=0.72:brightness=0.02,colorbalance=rm=0.08:gm=0.03:bm=-0.05",
    vignette: true,
    grain: 8,
    defBars: false,
  },
  {
    key: "none",
    name: "Tanpa Efek",
    tagline: "Warna asli video tanpa perubahan",
    css: "none",
    ff: "",
    vignette: false,
    grain: 0,
    defBars: false,
  },
];

export function getPreset(k: FramePresetKey): FramePreset {
  return FRAME_PRESETS.find((p) => p.key === k) ?? FRAME_PRESETS[0];
}

export const DEFAULT_SETTINGS: Settings = {
  splitMode: "duration",
  splitSeconds: 60,
  splitParts: 3,
  coverEnabled: true,
  coverSame: false,
  coverDuration: 2,
  coverPos: "tengah",
  title: {
    enabled: true,
    text: "",
    zone: "top",
    relX: 0.5,
    relY: 0.055,
    size: 58,
  },
  label: {
    enabled: true,
    format: "part",
    prefix: "BAGIAN KE-{n}",
    text: "",
    zone: "top",
    relX: 0.5,
    relY: 0.14,
    size: 44,
  },
  desc: {
    enabled: false,
    text: "",
    zone: "bottom",
    relX: 0.5,
    relY: 0.86,
    size: 38,
  },
  preset: "kolosal",
  bars: true,
  barSize: "sedang",
  ratio: "full",
  zoom: 1,
  quality: "balanced",
};

/** teks label untuk bagian ke-n, mis. "PART 1" */
export function labelTextFor(s: Settings, n: number): string {
  const map: Record<Exclude<LabelFormat, "custom">, string> = {
    part: "PART",
    bagian: "BAGIAN",
    eps: "EPS",
    episode: "EPISODE",
  };
  if (s.label.format === "custom") {
    const tpl = s.label.prefix && s.label.prefix.trim() ? s.label.prefix : "BAGIAN {n}";
    return tpl.replaceAll("{n}", String(n)).toUpperCase();
  }
  return `${map[s.label.format]} ${n}`;
}

/** kata label untuk nama file, mis. "Part" */
export function labelWordFor(s: Settings): string {
  const map: Record<LabelFormat, string> = {
    part: "Part",
    bagian: "Bagian",
    eps: "Eps",
    episode: "Episode",
    custom: "Bagian",
  };
  return map[s.label.format];
}

/** judul otomatis dari nama file */
export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  return base
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** nama file output yang aman */
export function sanitizeFile(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return (clean || "video").slice(0, 60);
}

/** jumlah karakter maksimum per baris agar muat di lebar 1080 */
export function maxCharsFor(fontPx: number): number {
  return Math.max(8, Math.floor((1080 - 90) / (fontPx * 0.52)));
}

/** word-wrap konsisten antara pratinjau dan render ffmpeg */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (cand.length <= maxChars) {
        line = cand;
      } else {
        if (line) out.push(line);
        if (w.length > maxChars) {
          // potong kata super panjang
          let rest = w;
          while (rest.length > maxChars) {
            out.push(rest.slice(0, maxChars));
            rest = rest.slice(maxChars);
          }
          line = rest;
        } else {
          line = w;
        }
      }
    }
    if (line) out.push(line);
  }
  return out.slice(0, 6); // maksimal 6 baris
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function pickText(raw: unknown, def: TextElement): TextElement {
  const r = (raw ?? {}) as Partial<TextElement>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : def.enabled,
    text: typeof r.text === "string" ? r.text.slice(0, 400) : def.text,
    zone: (["top", "center", "bottom"] as TextZone[]).includes(r.zone as TextZone)
      ? (r.zone as TextZone)
      : def.zone,
    relX: clamp(Number(r.relX ?? def.relX) || def.relX, 0.02, 0.98),
    relY: clamp(Number(r.relY ?? def.relY) || def.relY, 0.01, 0.99),
    size: clamp(Number(r.size ?? def.size) || def.size, 24, 110),
  };
}

/** validasi & normalisasi settings dari client */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  const preset: FramePresetKey = FRAME_PRESETS.some((p) => p.key === r.preset)
    ? (r.preset as FramePresetKey)
    : d.preset;
  const label = pickText(r.label, d.label) as LabelElement;
  label.format = (["part", "bagian", "eps", "episode", "custom"] as LabelFormat[]).includes(
    r.label?.format as LabelFormat
  )
    ? (r.label!.format as LabelFormat)
    : d.label.format;
  label.prefix = typeof r.label?.prefix === "string" ? r.label!.prefix.slice(0, 80) : d.label.prefix;
  return {
    splitMode: r.splitMode === "parts" ? "parts" : "duration",
    splitSeconds: clamp(Number(r.splitSeconds) || d.splitSeconds, 3, 3600),
    splitParts: clamp(Math.round(Number(r.splitParts) || d.splitParts), 1, 50),
    coverEnabled: typeof r.coverEnabled === "boolean" ? r.coverEnabled : d.coverEnabled,
    coverSame: typeof r.coverSame === "boolean" ? r.coverSame : d.coverSame,
    coverDuration: clamp(Number(r.coverDuration) || d.coverDuration, 1, 5),
    coverPos: r.coverPos === "awal" ? "awal" : "tengah",
    title: pickText(r.title, d.title),
    label,
    desc: pickText(r.desc, d.desc),
    preset,
    bars: typeof r.bars === "boolean" ? r.bars : d.bars,
    barSize: (["kecil", "sedang", "besar"] as BarSize[]).includes(r.barSize as BarSize)
      ? (r.barSize as BarSize)
      : d.barSize,
    ratio: r.ratio === "fit" ? "fit" : "full",
    zoom: clamp(Number(r.zoom) || d.zoom, 1, 2.5),
    quality: (["fast", "balanced", "high"] as QualityKey[]).includes(r.quality as QualityKey)
      ? (r.quality as QualityKey)
      : d.quality,
  };
}

/** format detik ke m:ss / h:mm:ss */
export function fmtDur(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export interface Segment {
  start: number;
  dur: number;
}

/** hitung potongan video berdasarkan mode split */
export function computeSegments(duration: number, s: Settings): Segment[] {
  if (!isFinite(duration) || duration <= 0) return [];
  const segDur =
    s.splitMode === "duration"
      ? clamp(s.splitSeconds, 3, 3600)
      : clamp(duration / clamp(s.splitParts, 1, 50), 0.5, 3600);
  const count = Math.min(50, Math.max(1, Math.ceil(duration / segDur - 0.03)));
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * segDur;
    const dur = Math.min(segDur, duration - start);
    if (dur >= 0.5) segs.push({ start, dur });
  }
  if (segs.length === 0) segs.push({ start: 0, dur: duration });
  return segs;
}

export const QUALITY_INFO: Record<QualityKey, { label: string; desc: string }> = {
  fast: { label: "Cepat", desc: "Hasil bagus, render paling cepat" },
  balanced: { label: "Seimbang", desc: "Kualitas & kecepatan seimbang (disarankan)" },
  high: { label: "Tinggi", desc: "Kualitas terbaik, render lebih lama" },
};
