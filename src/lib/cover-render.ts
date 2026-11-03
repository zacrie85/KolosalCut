// ============================================================
// KolosalCut v1.3.5 — Render COVER ala NOVACUT Studio (client)
// Port dari src/lib/editor/covers.ts (NOVACUT): 100 template,
// bingkai klasik/modern/futuristik, AI rekomendasi & frame grab.
//
// Cara kerja di KolosalCut (beda dgn NOVACUT):
// - Frame video diambil oleh FFmpeg di server (adegan/hitam/manual).
// - Client membuat 1 PNG overlay (gradasi + grafis template + judul
//   + bingkai) dan 1 PNG kecil per bagian (teks PART/EP).
// - Server menumpuk: frame -> overlay -> teks bagian.
// ============================================================

import {
  CoverTemplate,
  COVER_DARKEN,
  getCoverTemplate,
} from "@/lib/novacut-fx";
import { Settings, labelTextFor } from "@/lib/video-config";

// ---------- font mapping: id NOVACUT -> font bundel KolosalCut ----------

type NovaFontKind = "impact" | "condensed" | "display" | "sans";

export function novaFont(kind: NovaFontKind, px: number): string {
  switch (kind) {
    case "impact":
      return `400 ${px}px "KC Anton", "Arial Black", sans-serif`;
    case "condensed":
      return `400 ${px}px "KC Bebas", "Arial Narrow", sans-serif`;
    case "display":
      return `400 ${px}px "KC Archivo", "Arial Black", sans-serif`;
    default:
      return `800 ${px}px "KC Montserrat", Arial, sans-serif`;
  }
}

/** word-wrap utk kanvas: kata panjang dipecah per karakter (port NOVACUT) */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const fits = (s: string) => ctx.measureText(s).width <= maxWidth;
  for (let w of words) {
    while (ctx.measureText(w).width > maxWidth && w.length > 1) {
      let cut = w.length - 1;
      while (cut > 1 && !fits(w.slice(0, cut))) cut--;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const cand = line ? `${line} ${w}` : w;
    if (fits(cand)) line = cand;
    else {
      if (line) lines.push(line);
      line = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === 0 && text) lines.push(String(text).slice(0, 40));
  return lines.slice(0, maxLines);
}

function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, glow: string) {
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 28;
  ctx.fillText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------- bingkai cover (port NOVACUT v1.0.19) ----------

export type CoverFrameStyle = "none" | "klasik" | "modern" | "futuristik";

export const COVER_FRAME_OPTIONS: { id: CoverFrameStyle; label: string; desc: string }[] = [
  { id: "none", label: "Tanpa Bingkai", desc: "Cover polos — tanpa hiasan tepi." },
  { id: "klasik", label: "Klasik", desc: "Bingkai ganda emas + hiasan sudut, gaya poster bioskop vintage." },
  { id: "modern", label: "Modern", desc: "Garis bersih minimalis dengan aksen sudut." },
  { id: "futuristik", label: "Futuristik", desc: "Sudut HUD menyala + garis teknis, gaya sci-fi." },
];

const FRAME_ALPHA = 0.75;

export function drawCoverFrame(ctx: CanvasRenderingContext2D, w: number, h: number, style: CoverFrameStyle, accent = "#5ec8f8") {
  if (!style || style === "none") return;
  ctx.save();
  ctx.globalAlpha = FRAME_ALPHA;
  const m = Math.min(w, h) * 0.05;
  if (style === "klasik") drawFrameKlasik(ctx, w, h, m);
  else if (style === "modern") drawFrameModern(ctx, w, h, m, accent);
  else drawFrameFuturistik(ctx, w, h, m, accent);
  ctx.restore();
}

function drawFrameKlasik(ctx: CanvasRenderingContext2D, w: number, h: number, m: number) {
  const gold = "#ecd9a0";
  const deep = "#c9a24b";
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(2, h * 0.006);
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  const m2 = m * 1.6;
  ctx.lineWidth = Math.max(1, h * 0.0022);
  ctx.strokeRect(m2, m2, w - m2 * 2, h - m2 * 2);
  const d = m * 0.6;
  for (const [cx, cy] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = deep;
    ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.restore();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(cx, cy, d * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(1.5, h * 0.003);
  const a = m * 0.5;
  for (const [x, y, dx, dy] of [[w / 2, m, 1, 0], [w / 2, h - m, 1, 0], [m, h / 2, 0, 1], [w - m, h / 2, 0, 1]]) {
    ctx.beginPath();
    if (dx) ctx.arc(x, y, a, Math.PI * 0.15, Math.PI * 0.85, dy === 0);
    else ctx.arc(x, y, a, Math.PI * (dy > 0 ? 0.65 : -0.35), Math.PI * (dy > 0 ? 0.35 : -0.65));
    ctx.stroke();
  }
}

function drawFrameModern(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, accent: string) {
  const r = h * 0.022;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.5, h * 0.0075);
  ctx.beginPath();
  ctx.roundRect(m, m, w - m * 2, h - m * 2, r);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = Math.max(1, h * 0.002);
  const mo = m * 0.62;
  ctx.beginPath();
  ctx.roundRect(mo, mo, w - mo * 2, h - mo * 2, r * 0.7);
  ctx.stroke();
  ctx.restore();
  const s = Math.min(w, h) * 0.02;
  ctx.fillStyle = accent;
  ctx.fillRect(w - m - s / 2, m - s / 2, s, s);
  ctx.fillRect(m - s / 2, h - m - s / 2, s, s);
}

function drawFrameFuturistik(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, accent: string) {
  ctx.save();
  ctx.globalAlpha *= 0.5;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, h * 0.0022);
  const ch = Math.min(w, h) * 0.035;
  ctx.beginPath();
  ctx.moveTo(m + ch, m);
  ctx.lineTo(w - m - ch, m);
  ctx.lineTo(w - m, m + ch);
  ctx.lineTo(w - m, h - m - ch);
  ctx.lineTo(w - m - ch, h - m);
  ctx.lineTo(m + ch, h - m);
  ctx.lineTo(m, h - m - ch);
  ctx.lineTo(m, m + ch);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  const L = Math.min(w, h) * 0.13;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, h * 0.0085);
  ctx.shadowColor = accent;
  ctx.shadowBlur = Math.max(6, h * 0.018);
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + sx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * L);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  const n = 14;
  const tw = Math.max(1.5, h * 0.0028);
  for (let i = 3; i < n - 2; i++) {
    const x = m + ((w - m * 2) * i) / n;
    const len = i % 2 === 0 ? h * 0.014 : h * 0.008;
    ctx.fillRect(x - tw / 2, m + h * 0.004, tw, len);
    ctx.fillRect(x - tw / 2, h - m - h * 0.004 - len, tw, len);
  }
  const tri = Math.min(w, h) * 0.011;
  ctx.beginPath();
  ctx.moveTo(m, h / 2 - tri);
  ctx.lineTo(m + tri * 1.3, h / 2);
  ctx.lineTo(m, h / 2 + tri);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w - m, h / 2 - tri);
  ctx.lineTo(w - m - tri * 1.3, h / 2);
  ctx.lineTo(w - m, h / 2 + tri);
  ctx.closePath();
  ctx.fill();
}

// ---------- bagian latar & badge ----------

/** gambar frame video cover-fit (pratinjau) */
function drawBgImage(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const sw = (img as HTMLImageElement).naturalWidth || (img as HTMLVideoElement).videoWidth || 2;
  const sh = (img as HTMLImageElement).naturalHeight || (img as HTMLVideoElement).videoHeight || 2;
  const s = Math.max(w / sw, h / sh) * 1.02;
  ctx.drawImage(img, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
}

/** gradasi gelap vertikal agar teks terbaca (dipakai overlay & pratinjau) */
export function drawShade(ctx: CanvasRenderingContext2D, w: number, h: number, darken: number) {
  const g2 = ctx.createLinearGradient(0, 0, 0, h);
  g2.addColorStop(0, `rgba(0,0,0,${darken * 0.7})`);
  g2.addColorStop(0.5, `rgba(0,0,0,${darken * 0.25})`);
  g2.addColorStop(1, `rgba(0,0,0,${darken})`);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
}

/** badge kotak aksen dgn teks hitam (port NOVACUT drawPartBadge, teks dipusatkan benar) */
function drawBadgeBox(ctx: CanvasRenderingContext2D, part: string, pal: { fg: string; accent: string }, x: number, y: number, size: number, align: CanvasTextAlign = "left") {
  if (!part) return;
  ctx.font = novaFont("condensed", size);
  const tw = ctx.measureText(part.toUpperCase()).width;
  const padX = size * 0.5;
  const boxW = tw + padX * 2;
  const boxH = size * 1.6;
  const bx = align === "center" ? x - boxW / 2 : align === "right" ? x - boxW : x;
  ctx.fillStyle = pal.accent;
  ctx.fillRect(bx, y, boxW, boxH);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "middle";
  ctx.textAlign = align === "center" ? "center" : "left";
  const tx = align === "center" ? bx + boxW / 2 : bx + padX;
  ctx.fillText(part.toUpperCase(), tx, y + boxH / 2 + size * 0.04);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

// ---------- render lengkap (pratinjau) / overlay (ekspor) ----------

export interface CoverRenderOpts {
  template: CoverTemplate;
  title: string;
  part?: string;
  /** "img" = gambar latar (pratinjau), "black" = hitam polos, "none" = transparan (PNG overlay ekspor) */
  bgMode: "img" | "black" | "none";
  bgImg?: CanvasImageSource | null;
  frame?: CoverFrameStyle;
  /** manual "apa adanya": hanya gambar + bingkai, tanpa gradasi/grafis/teks */
  manualPlain?: boolean;
  /** gambar teks PART (badge) — false utk PNG overlay utama */
  withBadge?: boolean;
  w: number;
  h: number;
}

/** Render cover ala NOVACUT ke kanvas — dipakai pratinjau & generator PNG ekspor */
export function renderCoverCanvas(ctx: CanvasRenderingContext2D, o: CoverRenderOpts) {
  const { w, h, template } = o;
  const pal = template.palette;
  const accent = pal.accent;
  const fg = pal.fg;
  const title = o.title || "Judul Video";
  const part = o.part ?? "";
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic";

  const darken = COVER_DARKEN[template.layout] ?? 0.35;

  // ---- latar ----
  if (o.bgMode === "black") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const gv = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
    gv.addColorStop(0, "rgba(30,30,34,0.35)");
    gv.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gv;
    ctx.fillRect(0, 0, w, h);
  } else if (o.bgMode === "img" && o.bgImg) {
    drawBgImage(ctx, o.bgImg, w, h);
  } else if (o.bgMode === "img") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, pal.bg1);
    g.addColorStop(1, pal.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const plain = !!o.manualPlain;
  if (!plain) drawShade(ctx, w, h, darken);

  // ---- grafis & judul per layout (port NOVACUT covers.ts) ----
  const layouts: Record<string, () => void> = {
    impact: () => {
      ctx.textAlign = "center";
      ctx.font = novaFont("impact", h * 0.115);
      const lines = wrapText(ctx, title, w * 0.84, 3);
      const startY = h / 2 - ((lines.length - 1) * h * 0.125) / 2 + h * 0.03;
      lines.forEach((ln, i) => {
        const y = startY + i * h * 0.125;
        ctx.fillStyle = "#000";
        ctx.fillText(ln, w / 2 + h * 0.006, y + h * 0.006);
        ctx.fillStyle = fg;
        ctx.fillText(ln, w / 2, y);
      });
      ctx.fillStyle = accent;
      ctx.fillRect(w / 2 - w * 0.08, startY + lines.length * h * 0.125 - h * 0.06, w * 0.16, h * 0.012);
    },
    lower: () => {
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, h * 0.68, w * 0.72, h * 0.24);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h * 0.68, w * 0.012, h * 0.24);
      ctx.textAlign = "left";
      ctx.font = novaFont("impact", h * 0.085);
      const lines = wrapText(ctx, title, w * 0.64, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = "#000";
        ctx.fillText(ln, w * 0.04 + 3, h * 0.79 + i * h * 0.095 + 3);
        ctx.fillStyle = fg;
        ctx.fillText(ln, w * 0.04, h * 0.79 + i * h * 0.095);
      });
    },
    banner: () => {
      ctx.fillStyle = pal.bg1;
      ctx.fillRect(0, 0, w, h * 0.22);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h * 0.22, w, h * 0.012);
      ctx.textAlign = "center";
      let bsz = h * 0.1;
      ctx.font = novaFont("condensed", bsz);
      let blines = wrapText(ctx, title, w * 0.86, 1);
      if (blines.length > 1) {
        bsz = h * 0.062;
        ctx.font = novaFont("condensed", bsz);
        blines = wrapText(ctx, title, w * 0.86, 2);
      }
      ctx.fillStyle = fg;
      if (blines.length > 1) {
        blines.forEach((ln, i) => ctx.fillText(ln.toUpperCase(), w / 2, h * 0.095 + i * h * 0.08));
      } else {
        ctx.fillText(blines[0]?.toUpperCase() ?? "", w / 2, h * 0.15);
      }
    },
    side: () => {
      const g = ctx.createLinearGradient(0, 0, w * 0.62, 0);
      g.addColorStop(0, pal.bg1);
      g.addColorStop(0.75, pal.bg2);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w * 0.62, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, w * 0.014, h);
      ctx.textAlign = "left";
      ctx.font = novaFont("impact", h * 0.095);
      const lines = wrapText(ctx, title, w * 0.5, 3);
      lines.forEach((ln, i) => ctx.fillText(ln, w * 0.05, h * 0.42 + i * h * 0.11));
    },
    boxed: () => {
      ctx.strokeStyle = fg;
      ctx.lineWidth = h * 0.006;
      ctx.strokeRect(w * 0.09, h * 0.3, w * 0.82, h * 0.4);
      ctx.textAlign = "center";
      ctx.font = novaFont("condensed", h * 0.09);
      const lines = wrapText(ctx, title, w * 0.72, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = fg;
        const y = h * 0.47 + (i - (lines.length - 1) / 2) * h * 0.105;
        ctx.fillText(ln.toUpperCase(), w / 2, y);
      });
      ctx.fillStyle = pal.bg1;
      ctx.fillRect(w * 0.34, h * 0.28, w * 0.32, h * 0.045);
    },
    neon: () => {
      ctx.textAlign = "center";
      ctx.font = novaFont("display", h * 0.1);
      const lines = wrapText(ctx, title, w * 0.8, 2);
      lines.forEach((ln, i) => {
        const y = h * 0.48 + (i - (lines.length - 1) / 2) * h * 0.13;
        ctx.fillStyle = accent;
        glowText(ctx, ln.toUpperCase(), w / 2, y, accent);
        ctx.fillStyle = "#fff";
        ctx.fillText(ln.toUpperCase(), w / 2, y);
      });
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.06, h * 0.08, w * 0.88, h * 0.84);
      ctx.globalAlpha = 1;
    },
    bars: () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h * 0.14);
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      ctx.textAlign = "center";
      ctx.font = novaFont("condensed", h * 0.075);
      const lines = wrapText(ctx, title, w * 0.8, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = fg;
        ctx.fillText(ln.toUpperCase(), w / 2, h * 0.62 + (i - (lines.length - 1) / 2) * h * 0.085);
      });
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let x = w * 0.03; x < w; x += w * 0.09) {
        ctx.fillRect(x, h * 0.055, w * 0.03, h * 0.03);
        ctx.fillRect(x, h * 0.915, w * 0.03, h * 0.03);
      }
    },
    sticker: () => {
      ctx.textAlign = "center";
      ctx.font = novaFont("impact", h * 0.105);
      const lines = wrapText(ctx, title, w * 0.8, 3);
      lines.forEach((ln, i) => {
        const y = h * 0.62 + (i - (lines.length - 1) / 2) * h * 0.115;
        ctx.fillStyle = "#000";
        ctx.fillText(ln, w / 2 + 4, y + 4);
        ctx.fillStyle = fg;
        ctx.fillText(ln, w / 2, y);
      });
    },
    outline: () => {
      ctx.textAlign = "center";
      ctx.font = novaFont("impact", h * 0.17);
      const lines = wrapText(ctx, title.toUpperCase(), w * 0.9, 2);
      lines.forEach((ln, i) => {
        const y = h * 0.52 + (i - (lines.length - 1) / 2) * h * 0.17;
        ctx.strokeStyle = fg;
        ctx.lineWidth = h * 0.008;
        ctx.strokeText(ln, w / 2, y);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillText(ln, w / 2, y);
      });
      ctx.fillStyle = accent;
      ctx.fillRect(w * 0.2, h * 0.7, w * 0.6, h * 0.05);
    },
    band: () => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.06);
      const g = ctx.createLinearGradient(-w * 0.55, 0, w * 0.55, 0);
      g.addColorStop(0, pal.bg1);
      g.addColorStop(1, pal.bg2);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-w * 0.6, -h * 0.14, w * 1.2, h * 0.28);
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.fillRect(-w * 0.6, -h * 0.14, w * 1.2, h * 0.012);
      ctx.fillRect(-w * 0.6, h * 0.128, w * 1.2, h * 0.012);
      ctx.textAlign = "center";
      ctx.font = novaFont("condensed", h * 0.085);
      const lines = wrapText(ctx, title, w * 0.84, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = fg;
        ctx.fillText(ln.toUpperCase(), 0, (i - (lines.length - 1) / 2) * h * 0.095 + h * 0.032);
      });
      ctx.restore();
    },
  };

  if (!plain) (layouts[template.layout] ?? layouts.impact)();

  // ---- badge PART (dipisah ke PNG per bagian saat ekspor) ----
  if (o.withBadge && part) drawPartBadgeAt(ctx, template, part, w, h);

  // ---- bingkai paling atas ----
  if (o.frame && o.frame !== "none") drawCoverFrame(ctx, w, h, o.frame, accent);
}

/** Gambar HANYA teks/badge PART pada posisi gaya layout tsb (PNG per bagian)
 * CATATAN: TIDAK membersihkan kanvas — dipakai juga di atas cover jadi (pratinjau). */
export function drawPartBadgeAt(ctx: CanvasRenderingContext2D, template: CoverTemplate, part: string, w: number, h: number) {
  const pal = template.palette;
  const accent = pal.accent;
  ctx.textBaseline = "alphabetic";
  switch (template.layout) {
    case "lower":
      ctx.font = novaFont("sans", h * 0.03);
      ctx.fillStyle = accent;
      ctx.textAlign = "left";
      ctx.fillText(part.toUpperCase(), w * 0.04, h * 0.885);
      break;
    case "side":
      ctx.font = novaFont("sans", h * 0.028);
      ctx.fillStyle = accent;
      ctx.textAlign = "left";
      ctx.fillText(part.toUpperCase(), w * 0.05, h * 0.42 - h * 0.06);
      break;
    case "boxed":
      ctx.font = novaFont("sans", h * 0.026);
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.fillText(part.toUpperCase(), w / 2, h * 0.312);
      break;
    case "neon":
      ctx.font = novaFont("sans", h * 0.028);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(part.toUpperCase(), w / 2, h * 0.62);
      break;
    case "bars":
      ctx.font = novaFont("sans", h * 0.024);
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.fillText(part.toUpperCase(), w / 2, h * 0.8);
      break;
    case "sticker": {
      ctx.save();
      ctx.translate(w * 0.72, h * 0.24);
      ctx.rotate(-0.12);
      ctx.fillStyle = accent;
      ctx.beginPath();
      const bw = w * 0.2;
      const bh = h * 0.13;
      ctx.roundRect(-bw / 2, -bh / 2, bw, bh, h * 0.02);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = novaFont("impact", h * 0.032);
      ctx.textAlign = "center";
      ctx.fillText(part.toUpperCase().slice(0, 12), 0, h * 0.012);
      ctx.restore();
      break;
    }
    case "outline":
      ctx.font = novaFont("impact", h * 0.032);
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.fillText(part.toUpperCase(), w / 2, h * 0.74);
      break;
    case "band":
      drawBadgeBox(ctx, part, pal, w * 0.06, h * 0.78, h * 0.03);
      break;
    case "banner":
      drawBadgeBox(ctx, part, pal, w / 2, h * 0.8, h * 0.032, "center");
      break;
    case "impact":
    default:
      drawBadgeBox(ctx, part, pal, w / 2, h * 0.74, h * 0.032, "center");
      break;
  }
}

// ---------- generator payload ekspor (PNG overlay + PNG per bagian) ----------

export interface CoverExportPayload {
  /** PNG 1080x1920 (gradasi+grafis+judul+bingkai) — dipakai semua bagian */
  coverOverlay?: string;
  /** PNG 1080x1920 transparan berisi teks PART utk tiap bagian (urut) */
  coverParts: string[];
}

export function isNovacutCover(s: Settings): boolean {
  return s.coverEnabled && !!getCoverTemplate(s.coverTemplate);
}

export async function generateCoverPayload(
  s: Settings,
  jobTitle: string,
  partCount: number
): Promise<CoverExportPayload> {
  const template = getCoverTemplate(s.coverTemplate);
  if (!s.coverEnabled || !template) return { coverParts: [] };
  const W = 1080;
  const H = 1920;
  const title = (s.title.text || jobTitle || "").trim() || "Judul Video";
  const manualPlain = s.coverMode === "manual" && s.coverManualPlain;

  // overlay utama (tanpa badge PART)
  const c1 = document.createElement("canvas");
  c1.width = W;
  c1.height = H;
  const ctx1 = c1.getContext("2d");
  let coverOverlay: string | undefined;
  if (ctx1) {
    renderCoverCanvas(ctx1, {
      template,
      title,
      bgMode: "none",
      frame: s.coverFrameStyle,
      manualPlain,
      withBadge: false,
      w: W,
      h: H,
    });
    coverOverlay = c1.toDataURL("image/png");
  }

  // PNG teks PART per bagian (kecil, mostly transparan)
  const coverParts: string[] = [];
  if (!manualPlain) {
    for (let n = 1; n <= partCount; n++) {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) {
        coverParts.push("");
        continue;
      }
      drawPartBadgeAt(ctx, template, labelTextFor(s, n), W, H);
      coverParts.push(c.toDataURL("image/png"));
    }
  }
  return { coverOverlay, coverParts };
}

// ---------- frame grab dari video (port NOVACUT covers.ts) ----------

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Gagal memuat gambar"));
    img.src = url;
  });
}

function waitVideoFrame(video: HTMLVideoElement, timeoutMs = 1200): Promise<void> {
  type VFCVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  const v = video as VFCVideo;
  if (typeof v.requestVideoFrameCallback === "function") {
    return new Promise((res) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          res();
        }
      };
      v.requestVideoFrameCallback(finish);
      setTimeout(finish, timeoutMs);
    });
  }
  return new Promise((res) => setTimeout(res, 140));
}

async function seekVideo(video: HTMLVideoElement, t: number) {
  await new Promise<void>((res) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        res();
      }
    };
    video.onseeked = done;
    try {
      video.currentTime = Math.max(0, t);
    } catch {
      done();
    }
    setTimeout(done, 3000);
  });
  await waitVideoFrame(video);
}

async function loadVideo(video: HTMLVideoElement): Promise<boolean> {
  await new Promise<void>((res) => {
    if (video.readyState >= 2) return res();
    video.onloadeddata = () => res();
    video.onerror = () => res();
    setTimeout(res, 5000);
  });
  return !!video.videoWidth;
}

/** Ambil frame video pada waktu tertentu sebagai dataURL */
export async function grabFrame(url: string, time: number, maxW = 720): Promise<string | null> {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  const ok = await loadVideo(video);
  if (!ok) return null;
  await seekVideo(video, time);
  const scale = Math.min(1, maxW / (video.videoWidth || maxW));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round((video.videoWidth || 720) * scale));
  c.height = Math.max(2, Math.round((video.videoHeight || 1280) * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

/** kecerahan rata-rata frame (untuk rekomendasi AI) */
export function sampleBrightness(img: HTMLImageElement | HTMLCanvasElement): number {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 36;
  const ctx = c.getContext("2d");
  if (!ctx) return 128;
  ctx.drawImage(img, 0, 0, 64, 36);
  const d = ctx.getImageData(0, 0, 64, 36).data;
  let sum = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / n;
}
