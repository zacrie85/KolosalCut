// ============================================================
// KolosalCut — Konfigurasi bersama (client & server)
// ============================================================

import {
  TRANSITIONS,
  isValidEffect,
  getCoverTemplate,
} from "@/lib/novacut-fx";

// v1.3.5: "off" = EKSPORT SAJA (ala NOVACUT) — tiap video jadi 1 file utuh
export type SplitMode = "off" | "duration" | "parts";
export type LabelFormat = "part" | "bagian" | "eps" | "episode" | "custom";
export type RatioMode = "full" | "fit";
export type QualityKey = "fast" | "balanced" | "high";
export type BarSize = "kecil" | "sedang" | "besar";

// ============================================================
// v1.3.5 — MESIN RENDER ala NOVACUT (menu EKSPORT & SPLIT)
// ============================================================
/**
 * auto  : otomatis — MESIN KILAT bila video "split polos" (tanpa cover/efek/
 *         teks/gaya apa pun), selain itu MESIN PENUH. Disarankan.
 * kilat : paksa MESIN KILAT (potong tanpa render ulang, hitungan detik).
 *         Bila setelan butuh render (ada cover/efek/teks), otomatis jatuh
 *         ke MESIN PENUH dengan pemberitahuan di fase render.
 * penuh : selalu render ulang penuh (semua gaya & efek dijamin ikut).
 */
export type EngineKey = "auto" | "kilat" | "penuh";
export const ENGINE_INFO: Record<EngineKey, { label: string; desc: string }> = {
  auto: {
    label: "Otomatis",
    desc: "Kilat bila tanpa efek/cover/teks — penuh bila ada gaya. Paling cerdas.",
  },
  kilat: {
    label: "Kilat ⚡",
    desc: "Potong tanpa render ulang — secepat menyalin file (±detik per bagian). Potongan mengikuti keyframe video.",
  },
  penuh: {
    label: "Render Penuh",
    desc: "Render ulang semua bagian — semua cover, efek, teks & gaya dijamin ikut. Paling lambat.",
  },
};

/** jumlah video yang dirender serentak */
export type ParallelKey = 1 | 2 | 3 | 5 | 7;
export const PARALLEL_OPTIONS: ParallelKey[] = [1, 2, 3, 5, 7];

// ============================================================
// TEKS OTOMATIS (v1.3.3) — suara → teks via Whisper (offline)
// Fokus Bahasa Indonesia (resmi & slang). Tiga mode kecepatan.
// ============================================================
export type SubMode = "sangat-cepat" | "cepat" | "akurat";

export interface SubtitleSettings {
  /** aktif/nonaktif per video — dipilih manual oleh pengguna */
  enabled: boolean;
  /** kecepatan vs akurasi pembacaan suara */
  mode: SubMode;
  /** gaya tampilan teks pada video */
  style: SubStyle;
  /** posisi vertikal teks: 0 = paling atas, 1 = paling bawah (v1.3.4) */
  posY: number;
}

export type SubStyle = "klasik" | "tiktok" | "karaoke";

export const SUB_STYLES_INFO: Record<SubStyle, { label: string; desc: string }> = {
  klasik: { label: "Klasik", desc: "Teks putih di bawah, seperti film" },
  tiktok: { label: "TikTok", desc: "Teks besar rata tengah dengan latar gelap" },
  karaoke: { label: "Karaoke", desc: "Kata yang diucap menyala satu per satu" },
};
export const SUB_STYLE_KEYS: SubStyle[] = ["klasik", "tiktok", "karaoke"];

export const SUB_MODES_INFO: Record<SubMode, { label: string; desc: string }> = {
  "sangat-cepat": {
    label: "Sangat Cepat",
    desc: "Paling kilat — cocok untuk suara sangat jelas, akurasi dasar",
  },
  cepat: {
    label: "Cepat",
    desc: "Hasil cepat, rata-rata bagus (cocok untuk video jelas)",
  },
  akurat: {
    label: "Akurat",
    desc: "Lebih teliti untuk audio berisik/banyak istilah, agak lama",
  },
};
export const SUB_MODE_KEYS: SubMode[] = ["sangat-cepat", "cepat", "akurat"];

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
  | "archivo"
  // v1.4.2 — 8 font baru ala NOVACUT (semua TTF sudah dibundel di public/fonts)
  | "teko"
  | "russo"
  | "orbitron"
  | "rajdhani"
  | "barlow"
  | "michroma"
  | "righteous"
  | "alfaslab";

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
  // v1.4.2 — 8 font baru ala NOVACUT
  { key: "teko", name: "Teko (Judul Drama Padat)", file: "Teko-700.ttf", weight: 700, css: "KC Teko" },
  { key: "barlow", name: "Barlow Condensed (Subtitle Film)", file: "BarlowCondensed-600.ttf", weight: 600, css: "KC Barlow" },
  { key: "rajdhani", name: "Rajdhani (Tech Series)", file: "Rajdhani-700.ttf", weight: 700, css: "KC Rajdhani" },
  { key: "russo", name: "Russo One (Aksi)", file: "RussoOne-Regular.ttf", weight: 400, css: "KC Russo" },
  { key: "orbitron", name: "Orbitron (Futuristik)", file: "Orbitron-900.ttf", weight: 900, css: "KC Orbitron" },
  { key: "michroma", name: "Michroma (Sci-Fi)", file: "Michroma-Regular.ttf", weight: 400, css: "KC Michroma" },
  { key: "righteous", name: "Righteous (Retro Populer)", file: "Righteous-Regular.ttf", weight: 400, css: "KC Righteous" },
  { key: "alfaslab", name: "Alfa Slab One (Slab Tebal)", file: "AlfaSlabOne-Regular.ttf", weight: 400, css: "KC AlfaSlab" },
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

// ============================================================
// EFEK & COVER ala NOVACUT (v1.3.5)
// ============================================================

/** sumber latar cover: adegan dari video / unggahan sendiri */
export type CoverMode = "auto" | "manual";
/** latar cover mode otomatis: adegan video / hitam polos */
export type CoverBg = "adegan" | "hitam";
/** bingkai cover ala NOVACUT */
export type CoverFrameStyle = "none" | "klasik" | "modern" | "futuristik";

export interface Settings {
  splitMode: SplitMode;
  splitSeconds: number;
  splitParts: number;
  /** v1.3.5: mesin render ala NOVACUT — auto / kilat / penuh */
  engine: EngineKey;
  coverEnabled: boolean;
  coverSame: boolean;
  coverDuration: number;
  coverPos: "awal" | "tengah";
  // ---- v1.3.5: cover ala NOVACUT (100 template) ----
  /** "layout--palet" dari COVER_TEMPLATES; "legacy" = cover teks klasik lama */
  coverTemplate: string;
  /** sumber cover: otomatis frame video / unggahan sendiri */
  coverMode: CoverMode;
  /** latar mode otomatis: adegan video / hitam polos */
  coverBg: CoverBg;
  /** bingkai di sekeliling cover */
  coverFrameStyle: CoverFrameStyle;
  /** mode manual: gambar apa adanya tanpa teks */
  coverManualPlain: boolean;
  /** gambar unggahan (dataURL) — hanya dikirim saat membuat job */
  coverImage?: string;
  // ---- v1.3.5: efek blockbuster ala NOVACUT ----
  /** id efek (CLIP_EFFECTS) yang aktif */
  effects: string[];
  /** transisi masuk tiap bagian (id TRANSITIONS) atau null */
  transitionType: string | null;
  /** durasi transisi (detik) */
  transitionDur: number;
  /** kecepatan 0.25–4 (1 = normal) */
  speed: number;
  /** ulang potongan 1–10 (1 = sekali) */
  loopCount: number;
  title: TextElement;
  label: LabelElement;
  desc: TextElement;
  /** gaya frame overlay (neon / minimalis) */
  frame: FrameStyleKey;
  bars: boolean;
  barSize: BarSize;
  /** v1.4.2 — GAYA COVER NOVACUT: judul di atas, deskripsi + part/episode
   * SEBARIS (dipisah "·") tepat di bawah judul — persis cover referensi
   * "SHORT DRAMA MOVIES SERIES · Episode 2/30" */
  coverTextNovacut: boolean;
  ratio: RatioMode;
  /** perbesaran video 1 (normal) – 5 — v1.3.5: naik dari 2.5 agar video sinema bisa di-isi-frame penuh */
  zoom: number;
  /** posisi horizontal ambil gambar 0 (kiri) – 1 (kanan); 0.5 = tengah */
  panX: number;
  /** posisi vertikal ambil gambar 0 (atas) – 1 (bawah); 0.5 = tengah — v1.3.5 */
  panY: number;
  quality: QualityKey;
  /** jumlah video yang diproses serentak */
  parallel: ParallelKey;
  /** folder penyimpanan hasil render & split (kosong = folder bawaan aplikasi) */
  outputDir: string;
  /** teks otomatis dari suara (Whisper, Bahasa Indonesia) — v1.3.3 */
  subtitle: SubtitleSettings;
}

/** batas maksimal bagian per video */
export const MAX_PARTS = 50;

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
  // v1.3.5: mesin otomatis — split polos pakai KILAT (detik), ada gaya pakai PENUH
  engine: "auto",
  coverEnabled: true,
  coverSame: false,
  coverDuration: 2,
  coverPos: "tengah",
  // v1.3.5: cover default = template NOVACUT populer (Impact Center · Cyber Neon)
  coverTemplate: "impact--cyber",
  coverMode: "auto",
  coverBg: "adegan",
  coverFrameStyle: "none",
  coverManualPlain: false,
  coverImage: "",
  // v1.3.5: efek & transisi mati secara bawaan (hasil = video bersih)
  effects: [],
  transitionType: null,
  transitionDur: 0.6,
  speed: 1,
  loopCount: 1,
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
  // v1.4.2: gaya cover NOVACUT aktif bawaan — judul atas + deskripsi·episode sebaris
  coverTextNovacut: true,
  ratio: "full",
  zoom: 1,
  panX: 0.5,
  // v1.3.5: posisi vertikal bawaan = tengah, konsisten dgn panX
  panY: 0.5,
  quality: "balanced",
  // v1.3.2: default 2× — antrean panjang (mis. 50 video) hanya memproses
  // 2 video serentak; selesai satu, langsung lanjut antrean berikutnya.
  // Aman untuk PC, render tetap mengalir tanpa jeda menunggu pasangan.
  parallel: 2,
  outputDir: "",
  // v1.3.3: teks otomatis MATI secara bawaan — pengguna memilih per video
  // v1.3.4: posY 0.75 = zona subtitle khas reels (sedikit di bawah tengah)
  subtitle: { enabled: false, mode: "cepat", style: "tiktok", posY: 0.75 },
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
  const r = (raw ?? {}) as Partial<Settings> & { preset?: unknown };
  const d = DEFAULT_SETTINGS;
  // preset lama (sinema/epik/dll) dipetakan ke gaya frame baru
  const legacy = typeof r.preset === "string" ? r.preset : undefined;
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
    // v1.3.5: "off" = EKSPORT SAJA (1 file utuh tanpa dipecah)
    splitMode:
      r.splitMode === "off" || r.splitMode === "parts" ? (r.splitMode as SplitMode) : "duration",
    splitSeconds: clamp(Number(r.splitSeconds) || d.splitSeconds, 3, 3600),
    splitParts: clamp(Math.round(Number(r.splitParts) || d.splitParts), 1, 50),
    // v1.3.5: mesin render ala NOVACUT
    engine: (["auto", "kilat", "penuh"] as EngineKey[]).includes(r.engine as EngineKey)
      ? (r.engine as EngineKey)
      : d.engine,
    coverEnabled: typeof r.coverEnabled === "boolean" ? r.coverEnabled : d.coverEnabled,
    coverSame: typeof r.coverSame === "boolean" ? r.coverSame : d.coverSame,
    coverDuration: clamp(Number(r.coverDuration) || d.coverDuration, 1, 5),
    coverPos: r.coverPos === "awal" ? "awal" : "tengah",
    // v1.3.5: cover ala NOVACUT — template divalidasi terhadap registry;
    // "legacy" dipertahankan agar cover teks klasik masih bisa dipakai
    coverTemplate:
      r.coverTemplate === "legacy"
        ? "legacy"
        : getCoverTemplate(String(r.coverTemplate ?? ""))?.id ?? d.coverTemplate,
    coverMode: r.coverMode === "manual" ? "manual" : "auto",
    coverBg: r.coverBg === "hitam" ? "hitam" : "adegan",
    coverFrameStyle: (["none", "klasik", "modern", "futuristik"] as CoverFrameStyle[]).includes(
      r.coverFrameStyle as CoverFrameStyle
    )
      ? (r.coverFrameStyle as CoverFrameStyle)
      : d.coverFrameStyle,
    coverManualPlain: typeof r.coverManualPlain === "boolean" ? r.coverManualPlain : d.coverManualPlain,
    coverImage:
      typeof r.coverImage === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(r.coverImage)
        ? r.coverImage.slice(0, 12_000_000)
        : "",
    // v1.3.5: efek blockbuster — urutan dinormalkan sesuai registry, maks 20
    effects: Array.isArray(r.effects)
      ? [...new Set(r.effects.filter((x): x is string => isValidEffect(String(x))))].slice(0, 20)
      : d.effects,
    transitionType:
      r.transitionType && TRANSITIONS.some((t) => t.id === r.transitionType)
        ? (r.transitionType as string)
        : null,
    transitionDur: clamp(Number(r.transitionDur) || d.transitionDur, 0.2, 2),
    speed: clamp(Number(r.speed) || d.speed, 0.25, 4),
    loopCount: clamp(Math.round(Number(r.loopCount) || d.loopCount), 1, 10),
    title: pickText(r.title, d.title),
    label,
    desc: pickText(r.desc, d.desc),
    frame,
    bars: typeof r.bars === "boolean" ? r.bars : d.bars,
    // v1.4.2: gaya cover NOVACUT (judul atas + deskripsi·episode sebaris)
    coverTextNovacut: typeof r.coverTextNovacut === "boolean" ? r.coverTextNovacut : d.coverTextNovacut,
    barSize: (["kecil", "sedang", "besar"] as BarSize[]).includes(r.barSize as BarSize)
      ? (r.barSize as BarSize)
      : d.barSize,
    ratio: r.ratio === "fit" ? "fit" : "full",
    // v1.3.5: zoom diperluas sampai 5× (data lama dgn zoom kecil tetap aman)
    zoom: clamp(Number(r.zoom) || d.zoom, 1, 5),
    panX: Number.isFinite(Number(r.panX)) ? clamp(Number(r.panX), 0, 1) : d.panX,
    // v1.3.5: geser atas–bawah (0 = atas, 0.5 = tengah, 1 = bawah)
    panY: Number.isFinite(Number(r.panY)) ? clamp(Number(r.panY), 0, 1) : d.panY,
    quality: (["fast", "balanced", "high"] as QualityKey[]).includes(r.quality as QualityKey)
      ? (r.quality as QualityKey)
      : d.quality,
    parallel: PARALLEL_OPTIONS.includes(Number(r.parallel) as ParallelKey)
      ? (Number(r.parallel) as ParallelKey)
      : d.parallel,
    outputDir:
      typeof r.outputDir === "string"
        ? r.outputDir.trim().slice(0, 500)
        : d.outputDir,
    subtitle: {
      enabled: typeof r.subtitle?.enabled === "boolean" ? r.subtitle.enabled : d.subtitle.enabled,
      mode: SUB_MODE_KEYS.includes(r.subtitle?.mode as SubMode)
        ? (r.subtitle!.mode as SubMode)
        : d.subtitle.mode,
      style: SUB_STYLE_KEYS.includes(r.subtitle?.style as SubStyle)
        ? (r.subtitle!.style as SubStyle)
        : d.subtitle.style,
      // v1.3.4: posisi vertikal teks (0.05–0.95) — aman dari tepi layar
      posY: Number.isFinite(Number(r.subtitle?.posY))
        ? clamp(Number(r.subtitle!.posY), 0.05, 0.95)
        : d.subtitle.posY,
    },
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

/**
 * Hitung potongan video berdasarkan mode split.
 *
 * JAMINAN PENTING (fix v1.2.0): jumlah durasi semua bagian = durasi penuh video.
 * Sebelumnya, mode durasi pada video panjang (mis. 57:14 dengan potongan 1 menit
 * butuh 58 bagian) dipotong pada batas 50 bagian sehingga 7:14 terakhir video
 * tidak ikut terbagi — video "melewati batas sampai ke ujung frame".
 * Kini jika melebihi batas, SELURUH video dibagi rata menjadi 50 bagian.
 */
export function computeSegments(duration: number, s: Settings): Segment[] {
  if (!isFinite(duration) || duration <= 0) return [];
  // v1.3.5: EKSPORT SAJA — seluruh video jadi 1 file utuh tanpa dipecah
  if (s.splitMode === "off") return [{ start: 0, dur: duration }];
  let segDur =
    s.splitMode === "duration"
      ? clamp(s.splitSeconds, 3, 3600)
      : duration / clamp(s.splitParts, 1, MAX_PARTS);
  let count = Math.ceil(duration / segDur - 1e-6);
  if (count > MAX_PARTS) {
    // batas bagian tercapai -> bagi rata supaya seluruh video tetap terbagi habis
    count = MAX_PARTS;
    segDur = duration / count;
  }
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * segDur;
    segs.push({ start, dur: Math.min(segDur, duration - start) });
  }
  // ekor tersisa yang terlalu pendek (<0,5 detik) digabung ke bagian terakhir
  if (segs.length > 1 && segs[segs.length - 1].dur < 0.5) {
    segs.pop();
    segs[segs.length - 1].dur = duration - segs[segs.length - 1].start;
  }
  if (segs.length === 0) segs.push({ start: 0, dur: duration });
  return segs;
}

export const QUALITY_INFO: Record<QualityKey, { label: string; desc: string }> = {
  fast: { label: "Cepat", desc: "Hasil bagus, render paling cepat" },
  balanced: { label: "Seimbang", desc: "Kualitas & kecepatan seimbang (disarankan)" },
  high: { label: "Tinggi", desc: "Kualitas terbaik, render lebih lama" },
};

/**
 * v1.3.5 — Deteksi "SPLIT POLOS" utk MESIN KILAT (ala NOVACUT).
 * true = hasil akhir identik dengan video asli, hanya dipotong-potong:
 * tidak ada cover, frame neon, efek, transisi, teks, bar sinema, teks
 * otomatis, perubahan kecepatan/ulang, maupun zoom/geser — sehingga
 * potongan bisa dibuat TANPA render ulang (-c copy, hitungan detik).
 */
export function isPureSplit(s: Settings): boolean {
  if (s.coverEnabled) return false;
  if (s.frame !== "none") return false;
  if (Array.isArray(s.effects) && s.effects.length > 0) return false;
  if (s.transitionType) return false;
  if (s.bars) return false;
  if (s.title.enabled || s.label.enabled || s.desc.enabled) return false;
  if (s.subtitle.enabled) return false;
  if (Math.abs((Number(s.speed) || 1) - 1) > 1e-6) return false;
  if (Math.round(Number(s.loopCount) || 1) !== 1) return false;
  if (s.ratio !== "full") return false;
  if (Math.abs((Number(s.zoom) || 1) - 1) > 1e-6) return false;
  if (Math.abs((Number(s.panX) || 0.5) - 0.5) > 1e-6) return false;
  if (Math.abs((Number(s.panY) || 0.5) - 0.5) > 1e-6) return false;
  return true;
}
