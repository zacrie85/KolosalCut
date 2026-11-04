// NOVACUT Studio - Renderer visual: transisi & efek klip (canvas 2D)

export const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeOutBack = (p: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface TransitionOpts {
  scratch?: HTMLCanvasElement; // kanvas bantu (untuk pixelate)
  noise?: HTMLCanvasElement; // kanvas noise TV
  accent?: string;
}

/** Gambar src dengan cover-fit ke ctx (w,h) dengan scale/offset tambahan */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  w: number,
  h: number,
  opts: { scale?: number; dx?: number; dy?: number; alpha?: number } = {}
) {
  const sw = (src as HTMLCanvasElement).width || (src as HTMLImageElement).naturalWidth || 2;
  const sh = (src as HTMLCanvasElement).height || (src as HTMLImageElement).naturalHeight || 2;
  const s = Math.max(w / sw, h / sh) * (opts.scale ?? 1);
  const dw = sw * s;
  const dh = sh * s;
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.drawImage(src, (w - dw) / 2 + (opts.dx ?? 0), (h - dh) / 2 + (opts.dy ?? 0), dw, dh);
  ctx.globalAlpha = 1;
}

/**
 * Layout kadro (zoom & geser) untuk frame berukuran sw×sh ke kanvas w×h.
 * zoom 1 = ukuran asli (contain-fit): seluruh video terlihat utuh, TANPA zoom otomatis —
 * bar hitam muncul di sisi yang tidak terisi bila rasio sumber ≠ rasio frame.
 * Pengguna zoom manual (sampai 5x) untuk memperbesar; overX/overY = ruang geser tersedia.
 */
export function framingLayout(sw: number, sh: number, w: number, h: number, zoom: number): { base: number; dw: number; dh: number; overX: number; overY: number } {
  const z = Math.max(1, Math.min(5, zoom || 1));
  const base = Math.min(w / Math.max(1, sw), h / Math.max(1, sh)) * z;
  const dw = sw * base;
  const dh = sh * base;
  return { base, dw, dh, overX: Math.max(0, (dw - w) / 2), overY: Math.max(0, (dh - h) / 2) };
}

/** Zoom minimum agar sumber sw×sh mengisi penuh frame w×h (crop). Null bila dimensi tak diketahui. */
export function fillZoomFor(sw: number, sh: number, w: number, h: number): number | null {
  if (!sw || !sh) return null;
  const a = w / sw;
  const b = h / sh;
  return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100;
}

function withAlpha(ctx: CanvasRenderingContext2D, a: number, fn: () => void) {
  const old = ctx.globalAlpha;
  ctx.globalAlpha = a;
  fn();
  ctx.globalAlpha = old;
}

/** Terapkan transisi: p 0->1, a = frame keluar, b = frame masuk */
export function applyTransition(
  id: string,
  ctx: CanvasRenderingContext2D,
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
  p: number,
  w: number,
  h: number,
  opts: TransitionOpts = {}
) {
  const e = easeInOut(p);
  const A = () => drawCover(ctx, a, w, h);
  const B = () => drawCover(ctx, b, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  switch (id) {
    case "crossfade":
      A();
      withAlpha(ctx, p, B);
      break;
    case "dip-black":
      if (p < 0.5) withAlpha(ctx, 1 - p * 2, A);
      else withAlpha(ctx, (p - 0.5) * 2, B);
      break;
    case "dip-white":
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      if (p < 0.5) withAlpha(ctx, 1 - p * 2, A);
      else withAlpha(ctx, (p - 0.5) * 2, B);
      break;
    case "flash": {
      if (p < 0.5) A();
      else B();
      const fl = Math.pow(Math.sin(p * Math.PI), 4) * 0.98;
      ctx.fillStyle = `rgba(255,255,255,${fl})`;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "whip-pan": {
      const blur = Math.sin(p * Math.PI) * 16;
      ctx.filter = `blur(${blur}px)`;
      drawCover(ctx, a, w, h, { dx: -e * w });
      drawCover(ctx, b, w, h, { dx: (1 - e) * w });
      ctx.filter = "none";
      break;
    }
    case "zoom-punch": {
      drawCover(ctx, a, w, h, { scale: 1 + 0.45 * easeOut(p), alpha: 1 - p * 0.9 });
      withAlpha(ctx, Math.min(1, p * 1.4), () => drawCover(ctx, b, w, h, { scale: 0.65 + 0.35 * easeOutBack(p) }));
      break;
    }
    case "zoom-blast": {
      ctx.filter = `blur(${p * 9}px)`;
      drawCover(ctx, a, w, h, { scale: 1 + 1.3 * p * p, alpha: 1 - p });
      ctx.filter = `blur(${(1 - p) * 9}px)`;
      withAlpha(ctx, p, () => drawCover(ctx, b, w, h, { scale: 1.55 - 0.55 * easeOut(p) }));
      ctx.filter = "none";
      break;
    }
    case "glitch-rgb": {
      const base = p < 0.5 ? a : b;
      const inten = Math.sin(p * Math.PI);
      drawCover(ctx, base, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      withAlpha(ctx, 0.3 * inten, () => {
        ctx.filter = "hue-rotate(120deg) saturate(3)";
        drawCover(ctx, base, w, h, { dx: 10 * inten });
        ctx.filter = "hue-rotate(-120deg) saturate(3)";
        drawCover(ctx, base, w, h, { dx: -10 * inten });
      });
      ctx.restore();
      ctx.filter = "none";
      for (let i = 0; i < 7; i++) {
        const sy = Math.random() * h;
        const sh = 6 + Math.random() * 36;
        const dx = (Math.random() - 0.5) * 90 * inten;
        ctx.drawImage(base, 0, sy * (base.height / h), base.width, sh * (base.height / h), dx, sy, w, sh);
      }
      break;
    }
    case "shake-impact": {
      const base = p < 0.5 ? a : b;
      const amp = Math.sin(p * Math.PI) * 22;
      drawCover(ctx, base, w, h, { scale: 1.03, dx: (Math.random() - 0.5) * amp, dy: (Math.random() - 0.5) * amp });
      break;
    }
    case "bars-reveal": {
      if (p < 0.5) {
        A();
        const bh = easeInOut(p * 2) * (h / 2);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, bh);
        ctx.fillRect(0, h - bh, w, bh);
      } else {
        B();
        const bh = (1 - easeInOut((p - 0.5) * 2)) * (h / 2);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, bh);
        ctx.fillRect(0, h - bh, w, bh);
      }
      break;
    }
    case "film-burn": {
      A();
      withAlpha(ctx, clamp01((p - 0.35) / 0.3), B);
      const cx = w * (-0.25 + 1.5 * p);
      const cy = h * 0.5;
      const r = w * 0.3;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,220,0.95)");
      g.addColorStop(0.4, "rgba(255,150,40,0.75)");
      g.addColorStop(0.75, "rgba(200,40,10,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }
    case "slide-l":
      A();
      drawCover(ctx, a, w, h, { dx: 0 });
      withAlpha(ctx, 1, () => drawCover(ctx, b, w, h, { dx: (1 - e) * w }));
      break;
    case "slide-r":
      A();
      withAlpha(ctx, 1, () => drawCover(ctx, b, w, h, { dx: -(1 - e) * w }));
      break;
    case "slide-u":
      A();
      withAlpha(ctx, 1, () => drawCover(ctx, b, w, h, { dy: -(1 - e) * h }));
      break;
    case "slide-d":
      A();
      withAlpha(ctx, 1, () => drawCover(ctx, b, w, h, { dy: (1 - e) * h }));
      break;
    case "push-l":
      drawCover(ctx, a, w, h, { dx: -e * w });
      drawCover(ctx, b, w, h, { dx: (1 - e) * w });
      break;
    case "wipe-diag": {
      A();
      ctx.save();
      ctx.beginPath();
      const xTop = w * (2 * e - 1) + w * 0.3;
      const xBot = w * (2 * e - 1) - w * 0.1;
      ctx.moveTo(xBot, h);
      ctx.lineTo(xTop, 0);
      ctx.lineTo(w + 2, 0);
      ctx.lineTo(w + 2, h);
      ctx.closePath();
      ctx.clip();
      B();
      ctx.restore();
      const lx = e * (w * 1.4);
      const grad = ctx.createLinearGradient(lx - 60, 0, lx + 60, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${Math.sin(p * Math.PI) * 0.7})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(lx - 60, 0, 120, h);
      break;
    }
    case "iris": {
      A();
      const r = e * Math.hypot(w, h) * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.clip();
      B();
      ctx.restore();
      ctx.strokeStyle = opts.accent ?? "#fff";
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.6;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "blinds": {
      A();
      const n = 8;
      for (let i = 0; i < n; i++) {
        const lp = clamp01(p * 1.5 - (i / n) * 0.5);
        if (lp <= 0) continue;
        const y = (i * h) / n;
        const bh = (h / n) * easeInOut(lp);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, w, bh);
        ctx.clip();
        B();
        ctx.restore();
      }
      break;
    }
    case "split-v": {
      A();
      const half = (w / 2) * e;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, half, h);
      ctx.clip();
      drawCover(ctx, b, w, h, { dx: -((w / 2) * (1 - e)) });
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(w - half, 0, half + 1, h);
      ctx.clip();
      drawCover(ctx, b, w, h, { dx: (w / 2) * (1 - e) });
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(w / 2 - 1.5, 0, 3, h * Math.sin(p * Math.PI));
      break;
    }
    case "bounce": {
      A();
      const s = easeOutBack(p);
      withAlpha(ctx, Math.min(1, p * 2.5), () => drawCover(ctx, b, w, h, { scale: s }));
      break;
    }
    case "flare-sweep": {
      A();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * e, h);
      ctx.clip();
      B();
      ctx.restore();
      const x = w * p;
      const grad = ctx.createLinearGradient(x - w * 0.18, 0, x + w * 0.18, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,250,220,${Math.sin(p * Math.PI) * 0.85})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.fillRect(x - w * 0.18, 0, w * 0.36, h);
      ctx.restore();
      break;
    }
    case "blur-dissolve": {
      ctx.filter = `blur(${p * 12}px)`;
      A();
      ctx.filter = `blur(${(1 - p) * 12}px)`;
      withAlpha(ctx, p, B);
      ctx.filter = "none";
      break;
    }
    case "spin-swap": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(e * Math.PI * 0.5);
      ctx.globalAlpha = 1 - p;
      const s1 = 1 - e * 0.5;
      ctx.drawImage(a, (-w * s1) / 2, (-h * s1) / 2, w * s1, h * s1);
      ctx.restore();
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((e - 1) * Math.PI * 0.5);
      ctx.globalAlpha = p;
      const s2 = 0.5 + 0.5 * e;
      ctx.drawImage(b, (-w * s2) / 2, (-h * s2) / 2, w * s2, h * s2);
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }
    case "pixelate": {
      const base = p < 0.5 ? a : b;
      const px = Math.max(2, Math.round(Math.sin(p * Math.PI) * 48));
      const sc = opts.scratch;
      if (sc) {
        const tw = Math.max(2, Math.round(w / px));
        const th = Math.max(2, Math.round(h / px));
        sc.width = tw;
        sc.height = th;
        const sctx = sc.getContext("2d");
        if (sctx) {
          sctx.drawImage(base, 0, 0, tw, th);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sc, 0, 0, w, h);
          ctx.imageSmoothingEnabled = true;
        }
      } else drawCover(ctx, base, w, h);
      break;
    }
    case "tv-static": {
      const base = p < 0.45 ? a : b;
      drawCover(ctx, base, w, h);
      const inten = Math.pow(Math.sin(p * Math.PI), 1.4);
      if (opts.noise && inten > 0.02) {
        ctx.save();
        ctx.globalAlpha = inten;
        ctx.imageSmoothingEnabled = false;
        const nz = opts.noise;
        const ox = -Math.random() * 200;
        const oy = -Math.random() * 200;
        for (let x = ox; x < w; x += nz.width) for (let y = oy; y < h; y += nz.height) ctx.drawImage(nz, x, y);
        ctx.restore();
      }
      break;
    }
    case "chroma-slide": {
      const inten = Math.sin(p * Math.PI);
      drawCover(ctx, a, w, h, { dx: -e * w * 0.35, alpha: 1 - p * 0.6 });
      drawCover(ctx, b, w, h, { dx: (1 - e) * w });
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      withAlpha(ctx, 0.35 * inten, () => {
        ctx.filter = "hue-rotate(140deg) saturate(4)";
        drawCover(ctx, b, w, h, { dx: (1 - e) * w - 12 * inten });
        ctx.filter = "hue-rotate(-140deg) saturate(4)";
        drawCover(ctx, b, w, h, { dx: (1 - e) * w + 12 * inten });
      });
      ctx.restore();
      ctx.filter = "none";
      break;
    }
    case "mosaic": {
      A();
      const cols = 7;
      const rows = 4;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const seed = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
          const rndCell = seed - Math.floor(seed);
          const lp = clamp01((p - rndCell * 0.4) / 0.6);
          if (lp <= 0) continue;
          const cw = w / cols;
          const chh = h / rows;
          ctx.save();
          ctx.beginPath();
          ctx.rect(i * cw, j * chh, cw * easeOut(lp), chh * easeOut(lp));
          ctx.clip();
          B();
          ctx.restore();
        }
      }
      break;
    }
    default:
      A();
      withAlpha(ctx, p, B);
  }
}

// ===== EFEK KLIP =====

const GRADE_FILTERS: Record<string, string> = {
  "grade-teal": "contrast(1.18) saturate(1.3)",
  "grade-bleach": "contrast(1.45) saturate(0.5) brightness(1.08)",
  "grade-noir": "grayscale(1) contrast(1.3) brightness(1.02)",
  "grade-vintage": "sepia(0.45) contrast(0.95) saturate(0.85) brightness(1.05)",
  "grade-vhs": "saturate(1.35) contrast(1.12) brightness(1.02)",
  "grade-cyber": "saturate(1.55) contrast(1.18)",
  "grade-golden": "brightness(1.06) saturate(1.18) sepia(0.22)",
  "grade-cold": "saturate(0.9) contrast(1.22) brightness(0.96) hue-rotate(10deg)",
};

export function gradeFilterString(effects: string[]): string {
  const parts = effects.map((e) => GRADE_FILTERS[e]).filter(Boolean);
  return parts.length ? parts.join(" ") : "none";
}

const GRADE_TINTS: Record<string, { color: string; mode: GlobalCompositeOperation; alpha: number }[]> = {
  "grade-teal": [
    { color: "rgba(25,90,110,0.22)", mode: "multiply", alpha: 1 },
    { color: "rgba(255,150,60,0.16)", mode: "overlay", alpha: 1 },
  ],
  "grade-vintage": [{ color: "rgba(120,80,40,0.18)", mode: "multiply", alpha: 1 }],
  "grade-vhs": [
    { color: "rgba(40,60,120,0.12)", mode: "multiply", alpha: 1 },
    { color: "rgba(255,0,120,0.06)", mode: "screen", alpha: 1 },
  ],
  "grade-cyber": [
    { color: "rgba(60,20,90,0.22)", mode: "multiply", alpha: 1 },
    { color: "rgba(0,190,255,0.10)", mode: "screen", alpha: 1 },
  ],
  "grade-golden": [{ color: "rgba(255,170,60,0.20)", mode: "overlay", alpha: 1 }],
  "grade-cold": [{ color: "rgba(40,70,110,0.24)", mode: "multiply", alpha: 1 }],
  "grade-bleach": [{ color: "rgba(220,225,235,0.07)", mode: "screen", alpha: 1 }],
};

export function applyGradeTints(ctx: CanvasRenderingContext2D, effects: string[], w: number, h: number) {
  for (const fx of effects) {
    const tints = GRADE_TINTS[fx];
    if (!tints) continue;
    for (const t of tints) {
      ctx.save();
      ctx.globalCompositeOperation = t.mode;
      ctx.fillStyle = t.color;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

export interface OverlayOpts {
  t: number;
  local: number;
  progress: number; // 0..1 dalam klip
  grainPattern?: CanvasPattern | null;
  scratch?: HTMLCanvasElement;
}

export function applyOverlays(ctx: CanvasRenderingContext2D, effects: string[], w: number, h: number, o: OverlayOpts) {
  for (const fx of effects) {
    switch (fx) {
      case "fx-rgb": {
        const sc = o.scratch;
        if (sc) {
          sc.width = w;
          sc.height = h;
          const sctx = sc.getContext("2d");
          if (sctx) {
            sctx.clearRect(0, 0, w, h);
            sctx.drawImage(ctx.canvas, 0, 0);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.35;
            ctx.filter = "hue-rotate(120deg) saturate(3)";
            ctx.drawImage(sc, 4, 0, w, h);
            ctx.filter = "hue-rotate(-120deg) saturate(3)";
            ctx.drawImage(sc, -4, 0, w, h);
            ctx.restore();
            ctx.filter = "none";
          }
        }
        break;
      }
      case "fx-echo": {
        const sc = o.scratch;
        if (sc) {
          sc.width = w;
          sc.height = h;
          const sctx = sc.getContext("2d");
          if (sctx) {
            sctx.clearRect(0, 0, w, h);
            sctx.drawImage(ctx.canvas, 0, 0);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            for (let k = 1; k <= 3; k++) {
              ctx.globalAlpha = 0.16 / k;
              ctx.drawImage(sc, -k * 14, 0, w, h);
            }
            ctx.restore();
          }
        }
        break;
      }
      case "fx-scanline": {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
        ctx.restore();
        break;
      }
      case "fx-vignette": {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.6);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "fx-spotlight": {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.12, w / 2, h / 2, Math.hypot(w, h) * 0.55);
        g.addColorStop(0, "rgba(255,245,220,0.10)");
        g.addColorStop(0.5, "rgba(0,0,0,0.15)");
        g.addColorStop(1, "rgba(0,0,0,0.78)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "fx-grain": {
        if (o.grainPattern) {
          ctx.save();
          ctx.globalAlpha = 0.09;
          ctx.translate(-Math.random() * 256, -Math.random() * 256);
          ctx.fillStyle = o.grainPattern;
          ctx.fillRect(0, 0, w + 256, h + 256);
          ctx.restore();
        }
        break;
      }
      case "fx-letterbox": {
        const bh = h * 0.115;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, bh);
        ctx.fillRect(0, h - bh, w, bh);
        break;
      }
      case "fx-bloom": {
        const sc = o.scratch;
        if (sc) {
          sc.width = w;
          sc.height = h;
          const sctx = sc.getContext("2d");
          if (sctx) {
            sctx.clearRect(0, 0, w, h);
            sctx.drawImage(ctx.canvas, 0, 0);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.32;
            ctx.filter = "blur(16px) brightness(1.3) saturate(1.2)";
            ctx.drawImage(sc, 0, 0, w, h);
            ctx.restore();
            ctx.filter = "none";
          }
        }
        break;
      }
      case "fx-flare": {
        const cx = w * (0.25 + 0.5 * ((o.t * 0.13) % 1));
        const cy = h * 0.3;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.22);
        g.addColorStop(0, "rgba(255,240,200,0.55)");
        g.addColorStop(0.35, "rgba(255,180,90,0.22)");
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        break;
      }
    }
  }
}

/** Transform tambahan (zoom/shake) sebelum menggambar frame */
export function clipTransform(effects: string[], local: number, progress: number, t: number): { scale: number; dx: number; dy: number } {
  let scale = 1;
  let dx = 0;
  let dy = 0;
  if (effects.includes("fx-kenburns")) {
    scale *= 1 + 0.14 * progress;
    dx += (progress - 0.5) * 40;
    dy -= (progress - 0.5) * 18;
  }
  if (effects.includes("fx-pulse")) {
    scale *= 1 + 0.035 * Math.max(0, Math.sin(local * Math.PI * 2 * 2));
  }
  if (effects.includes("fx-shake")) {
    dx += Math.sin(t * 23.7) * 5 + Math.sin(t * 41.3) * 3;
    dy += Math.cos(t * 19.1) * 5 + Math.sin(t * 33.7) * 3;
  }
  return { scale, dx, dy };
}
