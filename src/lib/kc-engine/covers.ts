// NOVACUT Studio - Pembuat cover: 100 template populer + AI auto-cover

import { COVER_TEMPLATES, fontStack, type CoverTemplate } from "./constants";
import { wrapCanvasText } from "./textwrap";
import type { CoverFrameStyle } from "./types";

export interface CoverRenderInput {
  img: CanvasImageSource | null;
  title: string;
  part?: string; // mis. "Part 2/5"
  template: CoverTemplate;
  /** "hitam" = latar hitam polos (abaikan gambar); "adegan"/default = gambar adegan video */
  bgStyle?: "adegan" | "hitam";
  /** v1.0.19: bingkai di sekeliling cover — digambar transparan 75% di atas latar & teks */
  frame?: CoverFrameStyle;
  w: number;
  h: number;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  // pakai helper bersama: kata panjang tanpa spasi dipecah per karakter
  // agar judul film yang panjang tetap terbaca (bersambung ke baris bawah)
  return wrapCanvasText(ctx, text, maxWidth, { maxLines });
}

function drawBackground(ctx: CanvasRenderingContext2D, input: CoverRenderInput, darken: number) {
  const { w, h } = input;
  // latar hitam polos — pilihan pengguna, tanpa gambar adegan
  if (input.bgStyle === "hitam") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    // sedikit vignette halus agar tetap terlihat sinematik
    const gv = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
    gv.addColorStop(0, "rgba(30,30,34,0.35)");
    gv.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gv;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (input.img) {
    const sw = (input.img as HTMLCanvasElement).width || (input.img as HTMLImageElement).naturalWidth || 2;
    const sh = (input.img as HTMLCanvasElement).height || (input.img as HTMLImageElement).naturalHeight || 2;
    const s = Math.max(w / sw, h / sh) * 1.02;
    const dw = sw * s;
    const dh = sh * s;
    ctx.drawImage(input.img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, input.template.palette.bg1);
    g.addColorStop(1, input.template.palette.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // gradasi gelap agar teks terbaca
  const g2 = ctx.createLinearGradient(0, 0, 0, h);
  g2.addColorStop(0, `rgba(0,0,0,${darken * 0.7})`);
  g2.addColorStop(0.5, `rgba(0,0,0,${darken * 0.25})`);
  g2.addColorStop(1, `rgba(0,0,0,${darken})`);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
}

function drawPartBadge(ctx: CanvasRenderingContext2D, part: string, pal: { fg: string; accent: string }, x: number, y: number, size: number, align: CanvasTextAlign = "left") {
  if (!part) return;
  ctx.font = `700 ${size}px ${fontStack("condensed")}`;
  ctx.textAlign = align;
  const tw = ctx.measureText(part.toUpperCase()).width;
  const padX = size * 0.5;
  const boxW = tw + padX * 2;
  const boxH = size * 1.6;
  const bx = align === "center" ? x - boxW / 2 : align === "right" ? x - boxW : x;
  ctx.fillStyle = pal.accent;
  ctx.fillRect(bx, y, boxW, boxH);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "middle";
  ctx.fillText(part.toUpperCase(), bx + padX, y + boxH / 2 + size * 0.04);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, glow: string) {
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 28;
  ctx.fillStyle = ctx.fillStyle;
  ctx.fillText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ===== v1.0.19: BINGKAI COVER — KLASIK / MODERN / FUTURISTIK =====

/** Daftar pilihan bingkai cover (dipakai UI pemilih di Mode Sederhana & Cover Studio) */
export const COVER_FRAMES: { id: CoverFrameStyle; label: string; desc: string }[] = [
  { id: "none", label: "Tanpa Bingkai", desc: "Cover polos — tanpa hiasan tepi." },
  { id: "klasik", label: "Klasik", desc: "Bingkai ganda emas + hiasan sudut, gaya poster bioskop vintage." },
  { id: "modern", label: "Modern", desc: "Garis bersih minimalis dengan aksen sudut." },
  { id: "futuristik", label: "Futuristik", desc: "Sudut HUD menyala + garis teknis, gaya sci-fi." },
];

/** Transparansi bingkai: tampil 75% (latar cover masih sedikit terlihat) */
const FRAME_ALPHA = 0.75;

/** Gambar bingkai di sekeliling cover. Dipanggil SETELAH latar & teks (paling atas).
 * Semua gaya digambar dengan globalAlpha 0.75 — semi-transparan sesuai permintaan. */
export function drawCoverFrame(ctx: CanvasRenderingContext2D, w: number, h: number, style: CoverFrameStyle, accent = "#5ec8f8") {
  if (!style || style === "none") return;
  ctx.save();
  ctx.globalAlpha = FRAME_ALPHA;
  const m = Math.min(w, h) * 0.05; // jarak bingkai dari tepi
  if (style === "klasik") drawFrameKlasik(ctx, w, h, m);
  else if (style === "modern") drawFrameModern(ctx, w, h, m, accent);
  else drawFrameFuturistik(ctx, w, h, m, accent);
  ctx.restore();
}

/** KLASIK: bingkai ganda emas + belah ketupat di sudut — poster bioskop vintage */
function drawFrameKlasik(ctx: CanvasRenderingContext2D, w: number, h: number, m: number) {
  const gold = "#ecd9a0";
  const deep = "#c9a24b";
  // garis luar tebal
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(2, h * 0.006);
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  // garis dalam tipis
  const m2 = m * 1.6;
  ctx.lineWidth = Math.max(1, h * 0.0022);
  ctx.strokeRect(m2, m2, w - m2 * 2, h - m2 * 2);
  // hiasan sudut: belah ketupat + titik pusat di tiap sudut bingkai luar
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
  // lengkung kecil di tengah tiap sisi (sentuhan ukiran)
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

/** MODERN: satu garis rounded bersih + garis tipis luar + aksen persegi di 2 sudut */
function drawFrameModern(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, accent: string) {
  const r = h * 0.022;
  // garis utama putih
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.5, h * 0.0075);
  ctx.beginPath();
  ctx.roundRect(m, m, w - m * 2, h - m * 2, r);
  ctx.stroke();
  // garis tipis kedua sedikit di luarnya
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = Math.max(1, h * 0.002);
  const mo = m * 0.62;
  ctx.beginPath();
  ctx.roundRect(mo, mo, w - mo * 2, h - mo * 2, r * 0.7);
  ctx.stroke();
  ctx.restore();
  // aksen: kotak kecil di sudut kanan-atas & kiri-bawah
  const s = Math.min(w, h) * 0.02;
  ctx.fillStyle = accent;
  ctx.fillRect(w - m - s / 2, m - s / 2, s, s);
  ctx.fillRect(m - s / 2, h - m - s / 2, s, s);
}

/** FUTURISTIK: sudut HUD menyala + bingkai chamfer + garis tick teknis */
function drawFrameFuturistik(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, accent: string) {
  // garis penuh tipis dengan sudut terpotong 45° (chamfer)
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
  // 4 bracket sudut menyala
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
  // garis tick teknis di tepi atas & bawah
  ctx.fillStyle = accent;
  const n = 14;
  const tw = Math.max(1.5, h * 0.0028);
  for (let i = 3; i < n - 2; i++) {
    const x = m + ((w - m * 2) * i) / n;
    const len = i % 2 === 0 ? h * 0.014 : h * 0.008;
    ctx.fillRect(x - tw / 2, m + h * 0.004, tw, len);
    ctx.fillRect(x - tw / 2, h - m - h * 0.004 - len, tw, len);
  }
  // segitiga penunjuk kecil di tengah sisi kiri & kanan
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

/** Render satu cover ke ctx sesuai template */
export function renderCover(ctx: CanvasRenderingContext2D, input: CoverRenderInput) {
  const { w, h, template, title, part } = input;
  const pal = template.palette;
  const accent = pal.accent;
  const fg = pal.fg;
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic";

  const layouts: Record<string, () => void> = {
    impact: () => {
      drawBackground(ctx, input, 0.45);
      ctx.textAlign = "center";
      ctx.font = `900 ${h * 0.115}px ${fontStack("impact")}`;
      const lines = wrapText(ctx, title, w * 0.84, 3);
      const startY = h / 2 - ((lines.length - 1) * h * 0.125) / 2 + h * 0.03;
      ctx.fillStyle = fg;
      lines.forEach((ln, i) => {
        const y = startY + i * h * 0.125;
        ctx.fillStyle = "#000";
        ctx.fillText(ln, w / 2 + h * 0.006, y + h * 0.006);
        ctx.fillStyle = fg;
        ctx.fillText(ln, w / 2, y);
      });
      ctx.fillStyle = accent;
      ctx.fillRect(w / 2 - w * 0.08, startY + lines.length * h * 0.125 - h * 0.06, w * 0.16, h * 0.012);
      drawPartBadge(ctx, part ?? "", pal, w / 2, h * 0.74, h * 0.032, "center");
    },
    lower: () => {
      drawBackground(ctx, input, 0.3);
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, h * 0.68, w * 0.72, h * 0.24);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h * 0.68, w * 0.012, h * 0.24);
      ctx.textAlign = "left";
      ctx.font = `900 ${h * 0.085}px ${fontStack("impact")}`;
      const lines = wrapText(ctx, title, w * 0.64, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = "#000";
        ctx.fillText(ln, w * 0.04 + 3, h * 0.79 + i * h * 0.095 + 3);
        ctx.fillStyle = fg;
        ctx.fillText(ln, w * 0.04, h * 0.79 + i * h * 0.095);
      });
      if (part) {
        ctx.font = `700 ${h * 0.03}px ${fontStack("sans")}`;
        ctx.fillStyle = accent;
        ctx.fillText(part.toUpperCase(), w * 0.04, h * 0.885);
      }
    },
    banner: () => {
      drawBackground(ctx, input, 0.3);
      ctx.fillStyle = pal.bg1;
      ctx.fillRect(0, 0, w, h * 0.22);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h * 0.22, w, h * 0.012);
      ctx.textAlign = "center";
      // judul panjang: kecilkan font & turun jadi 2 baris di dalam banner
      let bsz = h * 0.1;
      ctx.font = `900 ${bsz}px ${fontStack("condensed")}`;
      let blines = wrapText(ctx, title, w * 0.86, 1);
      if (blines.length > 1) {
        bsz = h * 0.062;
        ctx.font = `900 ${bsz}px ${fontStack("condensed")}`;
        blines = wrapText(ctx, title, w * 0.86, 2);
      }
      ctx.fillStyle = fg;
      if (blines.length > 1) {
        blines.forEach((ln, i) => ctx.fillText(ln.toUpperCase(), w / 2, h * 0.095 + i * h * 0.08));
      } else {
        ctx.fillText(blines[0]?.toUpperCase() ?? "", w / 2, h * 0.15);
      }
      if (part) drawPartBadge(ctx, part, pal, w / 2, h * 0.8, h * 0.032, "center");
    },
    side: () => {
      drawBackground(ctx, input, 0.25);
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
      ctx.font = `900 ${h * 0.095}px ${fontStack("impact")}`;
      const lines = wrapText(ctx, title, w * 0.5, 3);
      lines.forEach((ln, i) => ctx.fillText(ln, w * 0.05, h * 0.42 + i * h * 0.11));
      ctx.fillStyle = accent;
      ctx.font = `700 ${h * 0.028}px ${fontStack("sans")}`;
      if (part) ctx.fillText(part.toUpperCase(), w * 0.05, h * 0.42 - h * 0.06);
    },
    boxed: () => {
      drawBackground(ctx, input, 0.35);
      ctx.strokeStyle = fg;
      ctx.lineWidth = h * 0.006;
      ctx.strokeRect(w * 0.09, h * 0.3, w * 0.82, h * 0.4);
      ctx.textAlign = "center";
      ctx.font = `900 ${h * 0.09}px ${fontStack("condensed")}`;
      const lines = wrapText(ctx, title, w * 0.72, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = fg;
        const y = h * 0.47 + (i - (lines.length - 1) / 2) * h * 0.105;
        ctx.fillText(ln.toUpperCase(), w / 2, y);
      });
      ctx.fillStyle = pal.bg1;
      ctx.fillRect(w * 0.34, h * 0.28, w * 0.32, h * 0.045);
      ctx.fillStyle = accent;
      ctx.font = `700 ${h * 0.026}px ${fontStack("sans")}`;
      ctx.fillText((part || "VIDEO").toUpperCase(), w / 2, h * 0.312);
    },
    neon: () => {
      drawBackground(ctx, input, 0.55);
      ctx.textAlign = "center";
      ctx.font = `900 ${h * 0.1}px ${fontStack("display")}`;
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
      if (part) {
        ctx.font = `700 ${h * 0.028}px ${fontStack("sans")}`;
        ctx.fillStyle = "#fff";
        ctx.fillText(part.toUpperCase(), w / 2, h * 0.62);
      }
    },
    bars: () => {
      drawBackground(ctx, input, 0.2);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h * 0.14);
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      ctx.textAlign = "center";
      ctx.font = `900 ${h * 0.075}px ${fontStack("condensed")}`;
      const lines = wrapText(ctx, title, w * 0.8, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = fg;
        ctx.fillText(ln.toUpperCase(), w / 2, h * 0.62 + (i - (lines.length - 1) / 2) * h * 0.085);
      });
      ctx.fillStyle = accent;
      ctx.font = `700 ${h * 0.024}px ${fontStack("sans")}`;
      ctx.fillText((part || "").toUpperCase(), w / 2, h * 0.8);
      // garis film
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let x = w * 0.03; x < w; x += w * 0.09) {
        ctx.fillRect(x, h * 0.055, w * 0.03, h * 0.03);
        ctx.fillRect(x, h * 0.915, w * 0.03, h * 0.03);
      }
    },
    sticker: () => {
      drawBackground(ctx, input, 0.3);
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
      ctx.font = `900 ${h * 0.032}px ${fontStack("impact")}`;
      ctx.textAlign = "center";
      ctx.fillText((part || "HOT").toUpperCase().slice(0, 12), 0, h * 0.012);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.font = `900 ${h * 0.105}px ${fontStack("impact")}`;
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
      drawBackground(ctx, input, 0.25);
      ctx.textAlign = "center";
      ctx.font = `900 ${h * 0.17}px ${fontStack("impact")}`;
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
      ctx.fillStyle = "#000";
      ctx.font = `900 ${h * 0.032}px ${fontStack("impact")}`;
      ctx.fillText((part || title.slice(0, 30)).toUpperCase(), w / 2, h * 0.74);
    },
    band: () => {
      drawBackground(ctx, input, 0.25);
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
      ctx.font = `900 ${h * 0.085}px ${fontStack("condensed")}`;
      const lines = wrapText(ctx, title, w * 0.84, 2);
      lines.forEach((ln, i) => {
        ctx.fillStyle = fg;
        ctx.fillText(ln.toUpperCase(), 0, (i - (lines.length - 1) / 2) * h * 0.095 + h * 0.032);
      });
      ctx.restore();
      if (part) drawPartBadge(ctx, part, pal, w * 0.06, h * 0.78, h * 0.03);
    },
  };

  (layouts[template.layout] ?? layouts.impact)();

  // v1.0.19: bingkai cover — digambar PALING ATAS mengelilingi tepi gambar
  if (input.frame && input.frame !== "none") drawCoverFrame(ctx, w, h, input.frame, accent);
}

/** Render cover ke kanvas offscreen & kembalikan dataURL */
export function renderCoverToDataURL(input: Omit<CoverRenderInput, "w" | "h">, w = 1280, h = 720): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  renderCover(ctx, { ...input, w, h });
  return c.toDataURL("image/jpeg", 0.92);
}

/** Cover polos: gambar unggahan pengguna apa adanya (tanpa teks template).
 * v1.0.19: mendukung bingkai cover opsional. */
export async function plainCoverDataURL(url: string, w: number, h: number, frame?: CoverFrameStyle): Promise<string> {
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const sw = img.naturalWidth || 2;
  const sh = img.naturalHeight || 2;
  const s = Math.max(w / sw, h / sh);
  ctx.drawImage(img, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
  if (frame && frame !== "none") drawCoverFrame(ctx, w, h, frame);
  return c.toDataURL("image/jpeg", 0.94);
}

// ===== AI AUTO-COVER =====

/** Muat gambar dan tunggu sampai benar-benar siap digambar */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Gagal memuat gambar"));
    img.src = url;
  });
}

/** Tunggu frame video benar-benar ter-render (mencegah gambar hitam) */
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

/** Seek video ke waktu t dan tunggu frame siap digambar */
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

/** Tunggu video siap (metadata + frame pertama) */
async function loadVideo(video: HTMLVideoElement): Promise<boolean> {
  await new Promise<void>((res) => {
    if (video.readyState >= 2) return res();
    video.onloadeddata = () => res();
    video.onerror = () => res();
    setTimeout(res, 5000);
  });
  return !!video.videoWidth;
}

export interface FrameScore {
  time: number;
  score: number;
  brightness: number;
  contrast: number;
}

/** Analisis & beri skor beberapa kandidat frame dari video */
export async function analyzeVideoFrames(url: string, duration: number, count = 8): Promise<{ scores: FrameScore[]; best: FrameScore | null }> {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  const ok = await loadVideo(video);
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 90;
  const ctx = c.getContext("2d");
  const scores: FrameScore[] = [];
  if (!ok || !ctx) return { scores, best: null };

  const times: number[] = [];
  for (let i = 0; i < count; i++) times.push(Math.min(duration - 0.1, 0.1 + ((duration - 0.3) * (i + 0.5)) / count));

  for (const t of times) {
    await seekVideo(video, t);
    ctx.drawImage(video, 0, 0, 160, 90);
    const data = ctx.getImageData(0, 0, 160, 90).data;
    let sum = 0;
    let sumSq = 0;
    let sat = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += lum;
      sumSq += lum * lum;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      sat += mx === 0 ? 0 : (mx - mn) / mx;
    }
    const mean = sum / n;
    const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    const meanSat = sat / n;
    // skor: pencahayaan ideal 90-170, kontras tinggi, warna hidup
    const exposure = Math.exp(-Math.pow((mean - 128) / 62, 2));
    const contrast = Math.min(1, std / 64);
    const color = Math.min(1, meanSat / 0.42);
    scores.push({ time: t, score: exposure * 0.45 + contrast * 0.35 + color * 0.2, brightness: mean, contrast: std });
  }
  scores.sort((a, b) => b.score - a.score);
  return { scores, best: scores[0] ?? null };
}

/** Ambil frame video pada waktu tertentu sebagai dataURL */
export async function grabFrame(url: string, time: number, maxW = 1280): Promise<string | null> {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  const ok = await loadVideo(video);
  if (!ok) return null;
  await seekVideo(video, time);
  const scale = Math.min(1, maxW / video.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

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

/** AI: pilih kombinasi frame + template terbaik (deterministik per judul) */
export function aiRecommendTemplates(title: string, brightness: number, count = 6): CoverTemplate[] {
  const rnd = mulberry32(hashStr(title || "novacut"));
  const long = title.length > 24;
  const dark = brightness < 105;
  const bright = brightness > 165;
  // bobot layout sesuai kondisi
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
