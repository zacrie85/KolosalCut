// ============================================================
// KolosalCut — Konfigurasi bersama (client & server)
// ============================================================

export type SplitMode = "duration" | "parts";
export type LabelFormat = "part" | "bagian" | "eps" | "episode" | "custom";
export type RatioMode = "full" | "fit";
export type QualityKey = "fast" | "balanced" | "high";
export type BarSize = "kecil" | "sedang" | "besar";

/** jumlah video yang dirender serentak */
export type ParallelKey = 1 | 3 | 5 | 7;
export const PARALLEL_OPTIONS: ParallelKey[] = [1, 3, 5, 7];

// ============================================================
// FONT SINEMATIK (semua lisensi OFL — bebas dibundel & didistribusikan)
// ============================================================
export type FontKey =
  | "carlito"
  | "anton"
  | "bebas"
  | "oswald"
  | "montserrat"
  | "playfair"
  | "cinzel"
  | "archivo";

export interface FontOption {
  key: FontKey;
  name: string;
  /** nama berkas TTF di folder fonts */
  file: string;
  /** bobot font sesuai berkas (dipakai pratinjau canvas) */
  weight: number;
  /** nama family @font-face untuk pratinjau browser */
  css: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "anton", name: "Anton (Poster Epik)", file: "anton.ttf", weight: 400, css: "KC Anton" },
  { key: "bebas", name: "Bebas Neue (Kapsul Sinema)", file: "bebas-neue.ttf", weight: 400, css: "KC Bebas" },
  { key: "oswald", name: "Oswald (Modern Tegas)", file: "oswald.ttf", weight: 600, css: "KC Oswald" },
  { key: "montserrat", name: "Montserrat Black (Bersih & Tebal)", file: "montserrat.ttf", weight: 800, css: "KC Montserrat" },
  { key: "playfair", name: "Playfair Display (Drama Klasik)", file: "playfair-display.ttf", weight: 800, css: "KC Playfair" },
  { key: "cinzel", name: "Cinzel (Hollywood Retro)", file: "cinzel.ttf", weight: 700, css: "KC Cinzel" },
  { key: "archivo", name: "Archivo Black (Kolosal Kokoh)", file: "archivo-black.ttf", weight: 400, css: "KC Archivo" },
  { key: "carlito", name: "Carlito (Standar)", file: "carlito.ttf", weight: 700, css: "KC Carlito" },
];

export function getFont(k: FontKey): FontOption {
  return FONT_OPTIONS.find((f) => f.key === k) ?? FONT_OPTIONS[0];
}

// ============================================================
// GAYA FRAME — overlay neon berputar & minimalis
// ============================================================
export type FrameStyleKey =
  | "none"
  | "neon-emas"
  | "neon-ganda"
  | "neon-pelangi"
  | "min-putih"
  | "min-emas"
  | "min-sudut"
  | "min-garis";

export interface FrameStyle {
  key: FrameStyleKey;
  name: string;
  tagline: string;
  /** none = tanpa frame; static = 1 PNG; anim = urutan PNG yang di-loop */
  kind: "none" | "static" | "anim";
  /** nama folder (anim) atau berkas PNG (static) di folder overlays */
  overlay?: string;
  /** fps urutan frame overlay (anim) */
  fps?: number;
  /** url aset pratinjau di /overlays */
  preview?: string;
  defBars: boolean;
}

export const FRAME_STYLES: FrameStyle[] = [
  {
    key: "none",
    name: "Tanpa Frame",
    tagline: "Video polos tanpa lapisan frame",
    kind: "none",
    defBars: false,
  },
  {
    key: "neon-emas",
    name: "Neon Emas",
    tagline: "Cahaya emas berputar mengelilingi frame 9:16",
    kind: "anim",
    overlay: "neon-emas",
    fps: 24,
    preview: "/overlays/neon-emas.webp",
    defBars: false,
  },
  {
    key: "neon-ganda",
    name: "Neon Ganda",
    tagline: "Dua komet neon cyan & magenta berputar bersamaan",
    kind: "anim",
    overlay: "neon-ganda",
    fps: 24,
    preview: "/overlays/neon-ganda.webp",
    defBars: false,
  },
  {
    key: "neon-pelangi",
    name: "Neon Pelangi",
    tagline: "Cahaya warna-warni berputar penuh energi",
    kind: "anim",
    overlay: "neon-pelangi",
    fps: 24,
    preview: "/overlays/neon-pelangi.webp",
    defBars: false,
  },
  {
    key: "min-putih",
    name: "Minimal Putih",
    tagline: "Garis putih tipis rapi mengikuti sudut frame",
    kind: "static",
    overlay: "min-putih",
    preview: "/overlays/min-putih.png",
    defBars: false,
  },
  {
    key: "min-emas",
    name: "Minimal Emas",
    tagline: "Garis emas tipis, elegan dan tenang",
    kind: "static",
    overlay: "min-emas",
    preview: "/overlays/min-emas.png",
    defBars: false,
  },
  {
    key: "min-sudut",
    name: "Minimal Sudut",
    tagline: "Hanya penanda sudut, ruang video lebih luas",
    kind: "static",
    overlay: "min-sudut",
    preview: "/overlays/min-sudut.png",
    defBars: false,
  },
  {
    key: "min-garis",
    name: "Minimal Garis",
    tagline: "Dua garis lembut di atas & bawah, gaya clean reel",
    kind: "static",
    overlay: "min-garis",
    preview: "/overlays/min-garis.png",
    defBars: false,
  },
];

export function getFrameStyle(k: FrameStyleKey): FrameStyle {
  return FRAME_STYLES.find((f) => f.key === k) ?? FRAME_STYLES[0];
}

// ============================================================
// ELEMEN TEKS & SETTINGS
// ============================================================
export interface TextElement {
  enabled: boolean;
  text: string;
  /** posisi horizontal pusat teks 0..1 — digeser bebas via drag pad / kanvas pratinjau */
  relX: number;
  /** posisi vertikal atas teks 0..1 — digeser bebas via drag pad / kanvas pratinjau */
  relY: number;
  /** ukuran font pada kanvas 1080px */
  size: number;
  /** pilihan font sinematik */
  font: FontKey;
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
  /** gaya frame overlay (neon / minimalis) */
  frame: FrameStyleKey;
  bars: boolean;
  barSize: BarSize;
  ratio: RatioMode;
  zoom: number;
  quality: QualityKey;
  /** jumlah video yang diproses serentak */
  parallel: ParallelKey;
}

/** tinggi bar sinema (px pada kanvas 1080x1920) */
export const BAR_H: Record<BarSize, number> = {
  kecil: 150,
  sedang: 235,
  besar: 340,
};

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
    relX: 0.5,
    relY: 0.055,
    size: 58,
    font: "anton",
  },
  label: {
    enabled: true,
    format: "part",
    prefix: "BAGIAN KE-{n}",
    text: "",
    relX: 0.5,
    relY: 0.14,
    size: 44,
    font: "montserrat",
  },
  desc: {
    enabled: false,
    text: "",
    relX: 0.5,
    relY: 0.86,
    size: 38,
    font: "carlito",
  },
  frame: "neon-emas",
  bars: true,
  barSize: "sedang",
  ratio: "full",
  zoom: 1,
  quality: "balanced",
  parallel: 5,
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
    relX: clamp(Number(r.relX ?? def.relX) || def.relX, 0.02, 0.98),
    relY: clamp(Number(r.relY ?? def.relY) || def.relY, 0.01, 0.99),
    size: clamp(Number(r.size ?? def.size) || def.size, 24, 120),
    font: FONT_OPTIONS.some((f) => f.key === r.font) ? (r.font as FontKey) : def.font,
  };
}

/** validasi & normalisasi settings dari client */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  // preset lama (sinema/epik/dll) dipetakan ke gaya frame baru
  const legacy = r.preset as string | undefined;
  const frameRaw = (r.frame ?? legacy) as FrameStyleKey | undefined;
  const frame: FrameStyleKey = FRAME_STYLES.some((f) => f.key === frameRaw)
    ? (frameRaw as FrameStyleKey)
    : d.frame;
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
    frame,
    bars: typeof r.bars === "boolean" ? r.bars : d.bars,
    barSize: (["kecil", "sedang", "besar"] as BarSize[]).includes(r.barSize as BarSize)
      ? (r.barSize as BarSize)
      : d.barSize,
    ratio: r.ratio === "fit" ? "fit" : "full",
    zoom: clamp(Number(r.zoom) || d.zoom, 1, 2.5),
    quality: (["fast", "balanced", "high"] as QualityKey[]).includes(r.quality as QualityKey)
      ? (r.quality as QualityKey)
      : d.quality,
    parallel: PARALLEL_OPTIONS.includes(Number(r.parallel) as ParallelKey)
      ? (Number(r.parallel) as ParallelKey)
      : d.parallel,
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
