// ============================================================
// KolosalCut v1.3.5 — REGISTRY EFEK & COVER ala NOVACUT Studio
// Port dari src/lib/editor/constants.ts + visual.ts (NOVACUT).
// Dipakai bersama oleh client (UI/pratinjau) & server (FFmpeg).
// TIDAK boleh mengimpor modul DOM/Node di sini.
// ============================================================

// ------------------------------------------------------------
// 28 TRANSISI MASUK (tampil di awal setiap bagian)
// ------------------------------------------------------------

export interface TransitionMeta {
  id: string;
  name: string;
  cat: "trailer" | "iklan" | "sinematik" | "trend";
  desc: string;
  /** nama transisi FFmpeg xfade yang dipakai server */
  xfade: string;
}

export const TRANSITIONS: TransitionMeta[] = [
  // Trailer Hollywood
  { id: "flash", name: "Flash Snap", cat: "trailer", desc: "Kilat putih ala trailer aksi Hollywood", xfade: "fadewhite" },
  { id: "whip-pan", name: "Whip Pan", cat: "trailer", desc: "Kamerasapu cepat dengan blur, khas trailer & vlog", xfade: "hblur" },
  { id: "zoom-punch", name: "Zoom Punch", cat: "trailer", desc: "Dorongan zoom khas trailer blockbuster", xfade: "zoomin" },
  { id: "zoom-blast", name: "Zoom Blast", cat: "trailer", desc: "Ledakan zoom radial dengan blur", xfade: "radial" },
  { id: "glitch-rgb", name: "RGB Glitch", cat: "trailer", desc: "Glitch digital ala trailer sci-fi", xfade: "hlslice" },
  { id: "shake-impact", name: "Impact Shake", cat: "trailer", desc: "Guncangan impact saat masuk adegan", xfade: "rectcrop" },
  { id: "bars-reveal", name: "Cinematic Bars", cat: "trailer", desc: "Bar hitam sinematik membuka adegan", xfade: "horzopen" },
  { id: "film-burn", name: "Film Burn", cat: "trailer", desc: "Light leak api khas film 35mm", xfade: "dissolve" },
  // Iklan Produk
  { id: "slide-l", name: "Slide Kiri", cat: "iklan", desc: "Geser masuk dari kanan", xfade: "slideleft" },
  { id: "slide-r", name: "Slide Kanan", cat: "iklan", desc: "Geser masuk dari kiri", xfade: "slideright" },
  { id: "slide-u", name: "Slide Atas", cat: "iklan", desc: "Geser masuk dari bawah", xfade: "slideup" },
  { id: "slide-d", name: "Slide Bawah", cat: "iklan", desc: "Geser masuk dari atas", xfade: "slidedown" },
  { id: "push-l", name: "Push Parallax", cat: "iklan", desc: "Dorongan parallax halus", xfade: "revealleft" },
  { id: "wipe-diag", name: "Diagonal Wipe", cat: "iklan", desc: "Sapuan diagonal dengan garis cahaya", xfade: "diagbl" },
  { id: "iris", name: "Iris Circle", cat: "iklan", desc: "Bukaan lingkaran klasik", xfade: "circleopen" },
  { id: "blinds", name: "Window Blinds", cat: "iklan", desc: "Bukaan tirai horizontal", xfade: "vuslice" },
  { id: "split-v", name: "Split Reveal", cat: "iklan", desc: "Belahan layar terbuka dari tengah", xfade: "squeezeh" },
  { id: "bounce", name: "Bounce Pop", cat: "iklan", desc: "Pantulan elastis playful", xfade: "circlecrop" },
  { id: "flare-sweep", name: "Flare Sweep", cat: "iklan", desc: "Sapuan flare produk premium", xfade: "smoothleft" },
  // Sinematik
  { id: "crossfade", name: "Cross Dissolve", cat: "sinematik", desc: "Lebur klasik halus", xfade: "fade" },
  { id: "dip-black", name: "Dip ke Hitam", cat: "sinematik", desc: "Tenggelam ke hitam lalu bangkit", xfade: "fadeblack" },
  { id: "dip-white", name: "Dip ke Putih", cat: "sinematik", desc: "Tenggelam ke putih terang", xfade: "fadewhite" },
  { id: "blur-dissolve", name: "Blur Dissolve", cat: "sinematik", desc: "Lebur dengan blur mimpi", xfade: "distance" },
  // Trend Viral
  { id: "spin-swap", name: "Spin Swap", cat: "trend", desc: "Putaran pertukaran adegan", xfade: "circleclose" },
  { id: "pixelate", name: "Pixelate", cat: "trend", desc: "Pecah piksel ala game retro", xfade: "pixelize" },
  { id: "tv-static", name: "TV Static", cat: "trend", desc: "Debu TV analog", xfade: "hlwind" },
  { id: "chroma-slide", name: "Chromatic Slide", cat: "trend", desc: "Geser dengan bayangan RGB", xfade: "slideleft" },
  { id: "mosaic", name: "Mosaic Reveal", cat: "trend", desc: "Ubin mosaik menyusun adegan", xfade: "vdslice" },
];

export const TRANSITION_CATS: { id: TransitionMeta["cat"]; name: string }[] = [
  { id: "trailer", name: "Trailer Hollywood" },
  { id: "iklan", name: "Iklan Produk" },
  { id: "sinematik", name: "Sinematik" },
  { id: "trend", name: "Trend Viral" },
];

export function getTransition(id: string): TransitionMeta | undefined {
  return TRANSITIONS.find((t) => t.id === id);
}

// ------------------------------------------------------------
// 20 EFEK BLOCKBUSTER (8 color grading + 12 efek visual)
// ------------------------------------------------------------

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

export function isValidEffect(id: string): boolean {
  return CLIP_EFFECTS.some((e) => e.id === id);
}

/**
 * Rantai filter FFmpeg per efek (urutan = registry).
 * Dipakai server; pratinjau client memakai versi canvas (lihat preview-canvas).
 * Kenburns butuh durasi bagian (dtk) — diinterpolasi lewat placeholder {DUR}.
 */
export const EFFECT_FFMPEG: Record<string, string> = {
  // ---- color grading ----
  "grade-teal": "eq=contrast=1.18:saturation=1.3,colorbalance=rs=-0.05:gs=0.02:bs=0.10:rh=0.08:bh=-0.06",
  "grade-bleach": "eq=contrast=1.45:saturation=0.5:brightness=0.08",
  "grade-noir": "hue=s=0,eq=contrast=1.30:brightness=0.02",
  "grade-vintage": "eq=saturation=0.82:contrast=0.95:brightness=0.05,colorbalance=rs=0.05:bs=-0.03:rh=0.07:gh=0.02:bh=-0.06",
  "grade-vhs": "eq=saturation=1.35:contrast=1.12:brightness=0.02,rgbashift=rh=2:bh=-2",
  "grade-cyber": "eq=saturation=1.55:contrast=1.18,colorbalance=rs=0.07:bs=0.09:bh=0.05",
  "grade-golden": "eq=brightness=0.06:saturation=1.18,colorbalance=rh=0.10:gh=0.04:bh=-0.10",
  "grade-cold": "eq=saturation=0.9:contrast=1.22:brightness=-0.04,colorbalance=rs=-0.06:bs=0.10:bh=0.05",
  // ---- efek visual (filter murni) ----
  "fx-letterbox": "drawbox=x=0:y=0:w=1080:h=220:color=black@1:t=fill,drawbox=x=0:y=1700:w=1080:h=220:color=black@1:t=fill",
  "fx-vignette": "vignette=angle=PI/5",
  "fx-grain": "noise=alls=8:allf=t+u",
  "fx-rgb": "rgbashift=rh=3:bh=-3",
  "fx-echo": "lagfun=decay=0.82",
  // fx-bloom, fx-shake, fx-pulse, fx-kenburns = graf berlabel (ditangani planEffects)
};

/** efek yang butuh file overlay PNG di folder overlays */
export const OVERLAY_EFFECTS: Record<string, string> = {
  "fx-scanline": "scanline.png",
  "fx-spotlight": "spotlight.png",
  "fx-flare": "flare.png",
};

export interface EffectPlan {
  /** urutan fragmen filter_complex berlabel: [fxN]...[fxN+1] */
  fragments: string[];
  labelIn: string;
  labelOut: string;
  /** overlay PNG yang perlu ditambahkan sbg input & ditumpuk di atas hasil */
  overlays: Array<"fx-scanline" | "fx-spotlight" | "fx-flare">;
}

/**
 * Susun rencana efek utk filter_complex FFmpeg.
 * effects dalam urutan bebas — diterapkan sesuai urutan registry agar konsisten.
 */
export function planEffects(effects: string[], durSec: number, fps = 30): EffectPlan | null {
  const ordered = CLIP_EFFECTS.map((e) => e.id).filter((id) => effects.includes(id));
  if (ordered.length === 0) return null;
  const fragments: string[] = [];
  let li = 0;
  let cur = `fx${li}`;
  const labelIn = cur;
  const overlays: EffectPlan["overlays"] = [];
  const dur = Math.max(0.1, durSec);

  for (const id of ordered) {
    const next = `fx${++li}`;
    if (id === "fx-bloom") {
      fragments.push(
        `[${cur}]split[fxa${li}][fxb${li}];` +
          `[fxb${li}]gblur=sigma=14:steps=2,eq=brightness=0.18:saturation=1.15[fxbl${li}];` +
          `[fxa${li}][fxbl${li}]blend=all_mode=screen:all_opacity=0.30[${next}]`
      );
    } else if (id === "fx-shake") {
      // margin 5% supaya getaran tidak keluar frame
      fragments.push(
        `[${cur}]scale=1134:2016:flags=lanczos,` +
          `crop=1080:1920:x='(in_w-1080)/2+(sin(t*23.7)*5+sin(t*41.3)*3)':y='(in_h-1920)/2+(cos(t*19.1)*5+sin(t*33.7)*3)'[${next}]`
      );
    } else if (id === "fx-pulse") {
      fragments.push(
        `[${cur}]zoompan=z='1+0.035*max(0,sin(in/${fps}*4*PI))':` +
          `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=${fps},setsar=1[${next}]`
      );
    } else if (id === "fx-kenburns") {
      // naikkan 8% agar geser Ken Burns tetap valid saat zoom mulai dari 1.0
      fragments.push(
        `[${cur}]scale=1166:2073:flags=lanczos,` +
          `zoompan=z='min(1.16,1+0.14*on/(${fps}*{DUR}))':` +
          `x='iw/2-(iw/zoom/2)-40*(on/(${fps}*{DUR})-0.5)':` +
          `y='ih/2-(ih/zoom/2)+18*(on/(${fps}*{DUR})-0.5)':d=1:s=1080x1920:fps=${fps},setsar=1[${next}]`
      );
    } else if (OVERLAY_EFFECTS[id]) {
      overlays.push(id as EffectPlan["overlays"][number]);
      // passthrough agar label tetap nyambung — overlay ditumpuk terpisah
      fragments.push(`[${cur}]null[${next}]`);
    } else {
      const f = EFFECT_FFMPEG[id];
      if (f) fragments.push(`[${cur}]${f}[${next}]`);
      else fragments.push(`[${cur}]null[${next}]`);
    }
    cur = next;
  }
  return { fragments, labelIn, labelOut: cur, overlays };
}

// ------------------------------------------------------------
// COVER — 10 LAYOUT x 10 PALET = 100 TEMPLATE (ala NOVACUT)
// ------------------------------------------------------------

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

export function getCoverTemplate(id: string): CoverTemplate | undefined {
  return COVER_TEMPLATES.find((t) => t.id === id);
}

/** derajat penggelapan latar per layout (sama dgn NOVACUT covers.ts) */
export const COVER_DARKEN: Record<string, number> = {
  impact: 0.45,
  lower: 0.3,
  banner: 0.3,
  side: 0.25,
  boxed: 0.35,
  neon: 0.55,
  bars: 0.2,
  sticker: 0.3,
  outline: 0.25,
  band: 0.25,
};

// ---- rekomendasi AI (deterministik per judul — port NOVACUT) ----

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** AI pilih kombinasi layout+palet terbaik (deterministik per judul) */
export function aiRecommendTemplates(title: string, brightness: number, count = 6): CoverTemplate[] {
  const rnd = mulberry32(hashStr(title || "kolosalcut"));
  const long = title.length > 24;
  const dark = brightness < 105;
  const bright = brightness > 165;
  const layoutWeights: Record<string, number> = {
    impact: long ? 0.6 : 2.2,
    lower: long ? 2.2 : 1.2,
    banner: 1,
    side: long ? 2 : 1.2,
    boxed: 1.1,
    neon: dark ? 2.4 : 0.8,
    bars: dark ? 1.6 : 1,
    sticker: bright ? 1.6 : 1,
    outline: long ? 0.7 : 2.2,
    band: 1.2,
  };
  const paletteWeights: Record<string, number> = {
    cyber: dark ? 2.2 : 1,
    sunset: 1.4,
    gold: 1.5,
    ice: bright ? 1.8 : 1,
    toxic: 1,
    royal: dark ? 1.6 : 1,
    blood: 1.2,
    mono: bright ? 1.4 : 0.9,
    candy: 1.1,
    ocean: 1.2,
  };
  const scored = COVER_TEMPLATES.map((t) => ({
    t,
    s: (layoutWeights[t.layout] ?? 1) * (paletteWeights[t.palette.id] ?? 1) * (t.popular ? 1.35 : 1) * (0.75 + rnd() * 0.6),
  }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, count).map((x) => x.t);
}
