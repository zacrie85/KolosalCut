// ============================================================
// KolosalCut v1.3.5 — Pratinjau efek canvas (port NOVACUT visual.ts)
// Dipakai preview-canvas agar monitor utama menampilkan efek live
// dengan hasil yang senada dgn filter FFmpeg di server.
// ============================================================

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

/** filter CSS utk ctx.filter — "none" bila tidak ada efek grading */
export function gradeFilterString(effects: string[]): string {
  if (!effects?.length) return "none";
  const parts = effects.map((e) => GRADE_FILTERS[e]).filter(Boolean);
  return parts.length ? parts.join(" ") : "none";
}

const GRADE_TINTS: Record<string, { color: string; mode: GlobalCompositeOperation }[]> = {
  "grade-teal": [
    { color: "rgba(25,90,110,0.22)", mode: "multiply" },
    { color: "rgba(255,150,60,0.16)", mode: "overlay" },
  ],
  "grade-vintage": [{ color: "rgba(120,80,40,0.18)", mode: "multiply" }],
  "grade-vhs": [
    { color: "rgba(40,60,120,0.12)", mode: "multiply" },
    { color: "rgba(255,0,120,0.06)", mode: "screen" },
  ],
  "grade-cyber": [
    { color: "rgba(60,20,90,0.22)", mode: "multiply" },
    { color: "rgba(0,190,255,0.10)", mode: "screen" },
  ],
  "grade-golden": [{ color: "rgba(255,170,60,0.20)", mode: "overlay" }],
  "grade-cold": [{ color: "rgba(40,70,110,0.24)", mode: "multiply" }],
  "grade-bleach": [{ color: "rgba(220,225,235,0.07)", mode: "screen" }],
};

/** lapisan warna tambahan (multiply/overlay/screen) sesuai efek grading */
export function applyGradeTints(ctx: CanvasRenderingContext2D, effects: string[], w: number, h: number) {
  if (!effects?.length) return;
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
  progress: number; // 0..1 dalam bagian
  grainPattern?: CanvasPattern | null;
  scratch?: HTMLCanvasElement | null;
}

/** efek visual bergambar langsung di kanvas (port applyOverlays NOVACUT) */
export function applyOverlays(ctx: CanvasRenderingContext2D, effects: string[], w: number, h: number, o: OverlayOpts) {
  if (!effects?.length) return;
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

/** transform tambahan (zoom/goyang) sebelum menggambar frame (port clipTransform NOVACUT) */
export function clipTransform(effects: string[], local: number, progress: number, t: number): { scale: number; dx: number; dy: number } {
  let scale = 1;
  let dx = 0;
  let dy = 0;
  if (!effects?.length) return { scale, dx, dy };
  if (effects.includes("fx-kenburns")) {
    const p = Math.max(0, Math.min(1, progress));
    scale *= 1 + 0.14 * p;
    dx += (p - 0.5) * 40;
    dy -= (p - 0.5) * 18;
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

/** pola noise utk Film Grain — dibuat sekali lalu dipakai berulang */
export function makeNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const nctx = c.getContext("2d");
  if (!nctx) return null;
  const img = nctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 165;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return ctx.createPattern(c, "repeat");
}
