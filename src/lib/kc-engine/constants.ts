// NOVACUT Studio - Registry konstanta (transisi, efek, teks, cover, musik)

export interface TransitionMeta {
  id: string;
  name: string;
  cat: "trailer" | "iklan" | "sinematik" | "trend";
  desc: string;
}

// ===== 28 TRANSISI =====
export const TRANSITIONS: TransitionMeta[] = [
  // Trailer Hollywood
  { id: "flash", name: "Flash Snap", cat: "trailer", desc: "Kilat putih ala trailer aksi Hollywood" },
  { id: "whip-pan", name: "Whip Pan", cat: "trailer", desc: "Kamerasapu cepat, khas trailer & vlog sinematik" },
  { id: "zoom-punch", name: "Zoom Punch", cat: "trailer", desc: "Dorongan zoom khas trailer blockbuster" },
  { id: "zoom-blast", name: "Zoom Blast", cat: "trailer", desc: "Ledakan zoom radial dengan blur" },
  { id: "glitch-rgb", name: "RGB Glitch", cat: "trailer", desc: "Glitch digital ala trailer sci-fi" },
  { id: "shake-impact", name: "Impact Shake", cat: "trailer", desc: "Guncangan impact saat dub" },
  { id: "bars-reveal", name: "Cinematic Bars", cat: "trailer", desc: "Bar hitam sinematik menutup lalu membuka" },
  { id: "film-burn", name: "Film Burn", cat: "trailer", desc: "Light leak api khas film 35mm" },
  // Iklan Produk
  { id: "slide-l", name: "Slide Kiri", cat: "iklan", desc: "Geser masuk dari kanan" },
  { id: "slide-r", name: "Slide Kanan", cat: "iklan", desc: "Geser masuk dari kiri" },
  { id: "slide-u", name: "Slide Atas", cat: "iklan", desc: "Geser masuk dari bawah" },
  { id: "slide-d", name: "Slide Bawah", cat: "iklan", desc: "Geser masuk dari atas" },
  { id: "push-l", name: "Push Parallax", cat: "iklan", desc: "Dorongan parallax halus" },
  { id: "wipe-diag", name: "Diagonal Wipe", cat: "iklan", desc: "Sapuan diagonal dengan garis cahaya" },
  { id: "iris", name: "Iris Circle", cat: "iklan", desc: "Bukaan lingkaran klasik" },
  { id: "blinds", name: "Window Blinds", cat: "iklan", desc: "Bukaan tirai horizontal" },
  { id: "split-v", name: "Split Reveal", cat: "iklan", desc: "Belahan layar terbuka dari tengah" },
  { id: "bounce", name: "Bounce Pop", cat: "iklan", desc: "Pantulan elastis playful" },
  { id: "flare-sweep", name: "Flare Sweep", cat: "iklan", desc: "Sapuan flare produk premium" },
  // Sinematik
  { id: "crossfade", name: "Cross Dissolve", cat: "sinematik", desc: "Lebur klasik halus" },
  { id: "dip-black", name: "Dip ke Hitam", cat: "sinematik", desc: "Tenggelam ke hitam lalu bangkit" },
  { id: "dip-white", name: "Dip ke Putih", cat: "sinematik", desc: "Tenggelam ke putih terang" },
  { id: "blur-dissolve", name: "Blur Dissolve", cat: "sinematik", desc: "Lebur dengan blur mimpi" },
  // Trend Viral
  { id: "spin-swap", name: "Spin Swap", cat: "trend", desc: "Putaran pertukaran adegan" },
  { id: "pixelate", name: "Pixelate", cat: "trend", desc: "Pecah piksel ala game retro" },
  { id: "tv-static", name: "TV Static", cat: "trend", desc: "Debu TV analog" },
  { id: "chroma-slide", name: "Chromatic Slide", cat: "trend", desc: "Geser dengan bayangan RGB" },
  { id: "mosaic", name: "Mosaic Reveal", cat: "trend", desc: "Ubin mosaik menyusun adegan" },
];

export const TRANSITION_CATS: { id: TransitionMeta["cat"]; name: string }[] = [
  { id: "trailer", name: "Trailer Hollywood" },
  { id: "iklan", name: "Iklan Produk" },
  { id: "sinematik", name: "Sinematik" },
  { id: "trend", name: "Trend Viral" },
];

// ===== 20 EFEK KLIP (BLOCKBUSTER) =====
export interface EffectMeta {
  id: string;
  name: string;
  group: "grade" | "fx";
  desc: string;
}

export const CLIP_EFFECTS: EffectMeta[] = [
  { id: "grade-teal", name: "Teal & Orange", group: "grade", desc: "Warna khas blockbuster Hollywood" },
  { id: "grade-bleach", name: "Bleach Bypass", group: "grade", desc: "Kontras pudar ala film perang" },
  { id: "grade-noir", name: "Noir", group: "grade", desc: "Hitam putih dramatis" },
  { id: "grade-vintage", name: "Vintage Film", group: "grade", desc: "Nostalgia film jadul" },
  { id: "grade-vhs", name: "VHS Retro", group: "grade", desc: "Kaset video 90-an" },
  { id: "grade-cyber", name: "Cyberpunk Neon", group: "grade", desc: "Neon magenta-cyan futuristik" },
  { id: "grade-golden", name: "Golden Hour", group: "grade", desc: "Cahaya senja hangat" },
  { id: "grade-cold", name: "Thriller Dingin", group: "grade", desc: "Tona dingin film thriller" },
  { id: "fx-letterbox", name: "Bar Sinematik", group: "fx", desc: "Garis hitam atas-bawah 2.39:1" },
  { id: "fx-vignette", name: "Vignette", group: "fx", desc: "Sudut gelap fokus tengah" },
  { id: "fx-grain", name: "Film Grain", group: "fx", desc: "Bintik film analog" },
  { id: "fx-bloom", name: "Bloom Glow", group: "fx", desc: "Pendar cahaya lembut" },
  { id: "fx-flare", name: "Lens Flare", group: "fx", desc: "Kilau lensa sinematik" },
  { id: "fx-rgb", name: "RGB Split", group: "fx", desc: "Pecah kanal warna" },
  { id: "fx-scanline", name: "Scanline CRT", group: "fx", desc: "Garis pindai TV tabung" },
  { id: "fx-shake", name: "Handheld Shake", group: "fx", desc: "Getar kamera tangan" },
  { id: "fx-pulse", name: "Beat Pulse", group: "fx", desc: "Denut zoom mengikuti beat" },
  { id: "fx-kenburns", name: "Slow Zoom", group: "fx", desc: "Zoom perlahan Ken Burns" },
  { id: "fx-echo", name: "Ghost Trail", group: "fx", desc: "Jejak bayangan bergerak" },
  { id: "fx-spotlight", name: "Spotlight", group: "fx", desc: "Sorot lampu panggung dramatis" },
];

// ===== ANIMASI TEKS =====
export const TEXT_ANIMS = [
  { id: "fade", name: "Fade" },
  { id: "rise", name: "Rise Up" },
  { id: "typewriter", name: "Typewriter" },
  { id: "slam", name: "Title Slam" },
  { id: "neon", name: "Neon Flicker" },
  { id: "tracking", name: "Tracking Expand" },
  { id: "glitch", name: "Glitch" },
  { id: "wipe", name: "Wipe Reveal" },
];

// ===== FONT =====
// 16 font: 5 dasar + 11 font sinematik/iklan. Semua TTF dibundel di public/fonts
// (dimuat offline lewat lib/fonts.ts, jadi tetap tampil tanpa internet).
export const TEXT_FONTS = [
  { id: "display", name: "Orbitron (Futuristik)", stack: '"Orbitron", "Arial Black", sans-serif' },
  { id: "impact", name: "Anton (Poster)", stack: '"Anton", Impact, sans-serif' },
  { id: "condensed", name: "Bebas Neue (Trailer)", stack: '"Bebas Neue", "Arial Narrow", sans-serif' },
  { id: "sans", name: "Rajdhani (Tech)", stack: '"Rajdhani", "Segoe UI", sans-serif' },
  { id: "serif", name: "Playfair (Elegan)", stack: '"Playfair Display", Georgia, serif' },
  // --- 11 font sinematik & iklan ---
  { id: "montserrat", name: "Montserrat (Iklan Modern)", stack: '"Montserrat", Arial, sans-serif' },
  { id: "oswald", name: "Oswald (Film & Trailer)", stack: '"Oswald", "Arial Narrow", sans-serif' },
  { id: "archivo", name: "Archivo Black (Poster Tebal)", stack: '"Archivo Black", "Arial Black", sans-serif' },
  { id: "barlow", name: "Barlow Condensed (Subtitle Film)", stack: '"Barlow Condensed", "Arial Narrow", sans-serif' },
  { id: "cinzel", name: "Cinzel (Epic Sinematik)", stack: '"Cinzel", Georgia, serif' },
  { id: "teko", name: "Teko (Judul Sport)", stack: '"Teko", "Arial Narrow", sans-serif' },
  { id: "russo", name: "Russo One (Aksi)", stack: '"Russo One", "Arial Black", sans-serif' },
  { id: "michroma", name: "Michroma (Sci-Fi)", stack: '"Michroma", Arial, sans-serif' },
  { id: "italiana", name: "Italiana (Elegan Klasik)", stack: '"Italiana", Georgia, serif' },
  { id: "righteous", name: "Righteous (Poster Retro)", stack: '"Righteous", Arial, sans-serif' },
  { id: "alfaslab", name: "Alfa Slab One (Slab Tebal)", stack: '"Alfa Slab One", Georgia, serif' },
];

export function fontStack(id: string): string {
  return TEXT_FONTS.find((f) => f.id === id)?.stack ?? TEXT_FONTS[3].stack;
}

// ===== COVER: 10 LAYOUT x 10 PALET = 100 TEMPLATE =====
export interface CoverPalette {
  id: string;
  name: string;
  fg: string;
  accent: string;
  bg1: string;
  bg2: string;
}

export const COVER_PALETTES: CoverPalette[] = [
  { id: "cyber", name: "Cyber Neon", fg: "#eafcff", accent: "#22d3ee", bg1: "#0b0f2a", bg2: "#310e5f" },
  { id: "sunset", name: "Sunset Fire", fg: "#fff7ec", accent: "#fb923c", bg1: "#3b0d20", bg2: "#7c2d12" },
  { id: "gold", name: "Gold Luxury", fg: "#fffbe9", accent: "#f5c542", bg1: "#141005", bg2: "#3d2e05" },
  { id: "ice", name: "Ice Cool", fg: "#f2fbff", accent: "#7dd3fc", bg1: "#071c26", bg2: "#0b3a4a" },
  { id: "toxic", name: "Toxic Green", fg: "#f2fff2", accent: "#4ade80", bg1: "#05140a", bg2: "#0f3d22" },
  { id: "royal", name: "Royal Purple", fg: "#faf5ff", accent: "#c084fc", bg1: "#160a2b", bg2: "#3b1263" },
  { id: "blood", name: "Blood Red", fg: "#fff2f2", accent: "#f87171", bg1: "#1b0505", bg2: "#450a0a" },
  { id: "mono", name: "Monochrome", fg: "#fafafa", accent: "#ffffff", bg1: "#09090b", bg2: "#27272a" },
  { id: "candy", name: "Candy Pop", fg: "#fffafc", accent: "#f472b6", bg1: "#2b0a1e", bg2: "#701a45" },
  { id: "ocean", name: "Ocean Deep", fg: "#effffa", accent: "#2dd4bf", bg1: "#04161c", bg2: "#134e4a" },
];

export interface CoverLayout {
  id: string;
  name: string;
  popular?: boolean;
}

export const COVER_LAYOUTS: CoverLayout[] = [
  { id: "impact", name: "Impact Center", popular: true },
  { id: "lower", name: "Lower Third", popular: true },
  { id: "banner", name: "Top Banner" },
  { id: "side", name: "Gradient Side", popular: true },
  { id: "boxed", name: "Boxed Title" },
  { id: "neon", name: "Neon Glow", popular: true },
  { id: "bars", name: "Cinematic Bars" },
  { id: "sticker", name: "Sticker Badge" },
  { id: "outline", name: "Outline Raksasa", popular: true },
  { id: "band", name: "Diagonal Band" },
];

export interface CoverTemplate {
  id: string; // "layout--palette"
  name: string;
  layout: string;
  palette: CoverPalette;
  popular: boolean;
}

export const COVER_TEMPLATES: CoverTemplate[] = COVER_LAYOUTS.flatMap((l) =>
  COVER_PALETTES.map((p) => ({
    id: `${l.id}--${p.id}`,
    name: `${l.name} · ${p.name}`,
    layout: l.id,
    palette: p,
    popular: !!l.popular,
  }))
);

// ===== PUSTAKA MUSIK (20 trek bebas hak cipta, disintesis) =====
export type DrumStyle = "epic" | "march" | "drive" | "four" | "trap" | "boombap" | "rock" | "breaks" | "lofi" | "none" | "tick";
export type BassStyle = "sub" | "saw" | "pluck" | "none";
export type ArpStyle = "up" | "down" | "updown" | "none";
export type ScaleName = "minor" | "major" | "phrygian" | "dorian";

export interface MusicDef {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  bars: number;
  root: number; // midi
  scale: ScaleName;
  chords: number[]; // derajat skala per bar (berulang)
  drums: DrumStyle;
  bass: BassStyle;
  pad: boolean;
  arp: ArpStyle;
  seventh?: boolean;
  color: string;
}

export const MUSIC_LIBRARY: MusicDef[] = [
  { id: "epic-trailer", name: "Epic Trailer Impact", genre: "Trailer", bpm: 90, bars: 16, root: 45, scale: "minor", chords: [0, 5, 2, 6], drums: "epic", bass: "sub", pad: true, arp: "none", color: "#f87171" },
  { id: "cinematic-rise", name: "Cinematic Rise", genre: "Sinematik", bpm: 80, bars: 16, root: 43, scale: "minor", chords: [0, 3, 5, 4], drums: "march", bass: "sub", pad: true, arp: "none", color: "#c084fc" },
  { id: "blockbuster-action", name: "Blockbuster Action", genre: "Aksi", bpm: 140, bars: 16, root: 41, scale: "phrygian", chords: [0, 0, 5, 6], drums: "drive", bass: "saw", pad: false, arp: "up", color: "#fb923c" },
  { id: "suspense", name: "Suspense Tension", genre: "Misteri", bpm: 100, bars: 16, root: 40, scale: "minor", chords: [0, 0, 1, 0], drums: "tick", bass: "sub", pad: true, arp: "none", color: "#94a3b8" },
  { id: "corporate", name: "Corporate Uplift", genre: "Korporat", bpm: 120, bars: 16, root: 48, scale: "major", chords: [0, 4, 5, 3], drums: "four", bass: "pluck", pad: true, arp: "up", color: "#4ade80" },
  { id: "happy-vlog", name: "Happy Vlog", genre: "Vlog", bpm: 126, bars: 16, root: 50, scale: "major", chords: [0, 3, 4, 4], drums: "four", bass: "pluck", pad: false, arp: "updown", color: "#facc15" },
  { id: "lofi", name: "Chill Lo-Fi", genre: "Lo-Fi", bpm: 78, bars: 16, root: 45, scale: "dorian", chords: [0, 3, 4, 2], drums: "lofi", bass: "sub", pad: true, arp: "none", seventh: true, color: "#a3e635" },
  { id: "synthwave", name: "Neon Synthwave", genre: "Synthwave", bpm: 110, bars: 16, root: 45, scale: "minor", chords: [0, 5, 3, 4], drums: "four", bass: "saw", pad: true, arp: "up", color: "#22d3ee" },
  { id: "edm", name: "EDM Drop", genre: "EDM", bpm: 128, bars: 16, root: 43, scale: "minor", chords: [0, 5, 6, 4], drums: "four", bass: "saw", pad: true, arp: "up", color: "#e879f9" },
  { id: "trap", name: "Trap Banger", genre: "Trap", bpm: 140, bars: 16, root: 42, scale: "phrygian", chords: [0, 0, 5, 1], drums: "trap", bass: "sub", pad: true, arp: "none", color: "#f472b6" },
  { id: "hiphop", name: "Hip-Hop Boom", genre: "Hip-Hop", bpm: 92, bars: 16, root: 45, scale: "minor", chords: [0, 0, 5, 3], drums: "boombap", bass: "pluck", pad: false, arp: "none", color: "#fdba74" },
  { id: "rock", name: "Rock Energy", genre: "Rock", bpm: 150, bars: 16, root: 40, scale: "phrygian", chords: [0, 0, 3, 5], drums: "rock", bass: "saw", pad: false, arp: "none", color: "#ef4444" },
  { id: "funk", name: "Funk Groove", genre: "Funk", bpm: 112, bars: 16, root: 46, scale: "dorian", chords: [0, 0, 3, 4], drums: "breaks", bass: "pluck", pad: false, arp: "updown", seventh: true, color: "#fde047" },
  { id: "tropical", name: "Tropical Summer", genre: "Tropical", bpm: 105, bars: 16, root: 52, scale: "major", chords: [0, 4, 5, 3], drums: "four", bass: "pluck", pad: true, arp: "up", color: "#2dd4bf" },
  { id: "ambient", name: "Ambient Dream", genre: "Ambient", bpm: 70, bars: 16, root: 48, scale: "major", chords: [0, 3, 5, 2], drums: "none", bass: "sub", pad: true, arp: "down", color: "#7dd3fc" },
  { id: "piano-drama", name: "Dramatic Piano", genre: "Drama", bpm: 84, bars: 16, root: 41, scale: "minor", chords: [0, 5, 2, 6], drums: "none", bass: "sub", pad: false, arp: "none", color: "#d8b4fe" },
  { id: "orchestral", name: "Epic Orchestral", genre: "Orkestra", bpm: 96, bars: 16, root: 43, scale: "minor", chords: [0, 3, 5, 6], drums: "march", bass: "sub", pad: true, arp: "none", color: "#fca5a5" },
  { id: "tech", name: "Tech Runner", genre: "Tekno", bpm: 132, bars: 16, root: 40, scale: "minor", chords: [0, 0, 6, 6], drums: "four", bass: "saw", pad: false, arp: "up", color: "#67e8f9" },
  { id: "sport", name: "Sport Hype", genre: "Olahraga", bpm: 128, bars: 16, root: 45, scale: "minor", chords: [0, 5, 0, 6], drums: "drive", bass: "saw", pad: true, arp: "updown", color: "#fbbf24" },
  { id: "dark-mystery", name: "Mystery Dark", genre: "Misteri", bpm: 95, bars: 16, root: 38, scale: "phrygian", chords: [0, 1, 0, 4], drums: "tick", bass: "sub", pad: true, arp: "down", color: "#9ca3af" },
];

// ===== LAIN-LAIN =====
export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export const LABEL_STYLES = ["Part", "Episode", "Bagian", "Eps", "EP"] as const;

export const TRACK_STYLE: Record<string, { color: string; label: string }> = {
  video: { color: "#4d9bf5", label: "Video" },
  image: { color: "#b08bf5", label: "Gambar" },
  text: { color: "#f5a623", label: "Teks" },
  audio: { color: "#34c77b", label: "Audio" },
};

export function fmtTime(t: number, withMs = false): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 100);
  const base = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return withMs ? `${base}.${String(ms).padStart(2, "0")}` : base;
}

export function fmtSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

/** v1.0.16: format estimasi waktu tersisa (detik) — "2j 15m" / "48 mnt" */
export function fmtEta(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${Math.max(1, m)} mnt`;
}

export function slugify(s: string): string {
  return (s || "video")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "video";
}

export function partLabel(style: string, index: number, total: number, withTotal: boolean): string {
  switch (style) {
    case "Episode":
      return withTotal ? `Episode ${index}/${total}` : `Episode ${index}`;
    case "Bagian":
      return withTotal ? `Bagian ${index}/${total}` : `Bagian ${index}`;
    case "Eps":
      return `EPS ${String(index).padStart(2, "0")}`;
    case "EP":
      return `EP ${String(index).padStart(2, "0")}`;
    default:
      return withTotal ? `Part ${index}/${total}` : `Part ${index}`;
  }
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
