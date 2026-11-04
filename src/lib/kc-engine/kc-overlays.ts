// ============================================================
// KolosalCut v1.4.0 — OVERLAY KHAS KOLOSALCUT di atas mesin NOVACUT
//  - Frame neon animasi (neon-emas / neon-ganda / neon-pelangi,
//    urutan PNG 24fps) & frame minimalis statis (min-*.png)
//  - Bar sinema (hitam atas-bawah, ukuran kecil/sedang/besar)
// Digambar di ATAS semua klip di akhir composeFrame sehingga hasil
// render identik dengan pipeline FFmpeg lama.
// Aset diambil dari /overlays (folder publik aplikasi).
// ============================================================

const animLoading = new Map<string, Promise<HTMLImageElement[]>>();
const animReady = new Map<string, HTMLImageElement[]>();
const staticLoading = new Map<string, Promise<HTMLImageElement | null>>();
const staticReady = new Map<string, HTMLImageElement | null>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat overlay: ${src}`));
    img.src = src;
  });
}

/** muat seluruh frame urutan overlay animasi (48 frame, loop 2 dtk @24fps) */
function loadAnim(name: string, count = 48): Promise<HTMLImageElement[]> {
  let p = animLoading.get(name);
  if (!p) {
    const jobs: Promise<HTMLImageElement>[] = [];
    for (let i = 0; i < count; i++) {
      jobs.push(loadImage(`/overlays/${name}/frame_${String(i).padStart(4, "0")}.png`));
    }
    p = Promise.all(jobs.map((j) => j.catch(() => null as unknown as HTMLImageElement))).then(
      (frames) => {
        animReady.set(name, frames);
        return frames;
      }
    );
    animLoading.set(name, p);
  }
  return p;
}

/** muat PNG overlay statis */
function loadStatic(name: string): Promise<HTMLImageElement | null> {
  let p = staticLoading.get(name);
  if (!p) {
    p = loadImage(`/overlays/${name}.png`)
      .then((img) => {
        staticReady.set(name, img);
        return img;
      })
      .catch(() => {
        staticReady.set(name, null);
        return null;
      });
    staticLoading.set(name, p);
  }
  return p;
}

export interface KcFrameCfg {
  /** key FRAME_STYLES: none | neon-emas | neon-ganda | neon-pelangi | min-* */
  key: string;
  /** bar sinema hitam atas-bawah */
  bars: boolean;
  /** tinggi bar (px pada kanvas 1920) */
  barH: number;
}

/** gambar frame overlay (animasi/statis) + bar sinema di atas kanvas hasil.
 * Bila overlay belum selesai dimuat, frame ini dilewati (bening) — cache
 * terisi dalam sepersekian detik dan frame berikutnya sudah lengkap. */
export function drawKcOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cfg: KcFrameCfg | undefined
): void {
  if (!ctx || !cfg) return;

  // ---- bar sinema (di bawah frame neon, di atas video) ----
  if (cfg.bars && cfg.barH > 0) {
    const bh = Math.round((cfg.barH / 1920) * h);
    if (bh > 0) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, bh);
      ctx.fillRect(0, h - bh, w, bh);
    }
  }

  // ---- frame overlay ----
  if (!cfg.key || cfg.key === "none") return;
  if (cfg.key.startsWith("neon-")) {
    const frames = animReady.get(cfg.key);
    if (!frames) {
      void loadAnim(cfg.key);
      return;
    }
    const usable = frames.filter((f) => f && f.complete && f.naturalWidth > 0);
    if (!usable.length) return;
    const fps = 24;
    const idx = Math.floor((((t % 2) + 2) % 2) * fps) % usable.length;
    ctx.drawImage(usable[idx], 0, 0, w, h);
    return;
  }
  // statis (min-*)
  const img = staticReady.get(cfg.key);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  if (!staticLoading.has(cfg.key)) void loadStatic(cfg.key);
}

/** pemanasan cache overlay (panggil saat batch mulai) */
export function preloadKcOverlay(cfg: KcFrameCfg | undefined): void {
  if (!cfg || !cfg.key || cfg.key === "none") return;
  if (cfg.key.startsWith("neon-")) void loadAnim(cfg.key);
  else void loadStatic(cfg.key);
}
