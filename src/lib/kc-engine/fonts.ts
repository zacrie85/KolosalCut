// NOVACUT Studio - Pemuat font bundel (offline).
// Semua TTF ada di public/fonts — didaftarkan lewat FontFace API sehingga
// canvas & UI tetap memakai font asli WALAUPUN tanpa koneksi internet
// (sebelumnya via @import Google Fonts yang gagal saat offline).

const FONT_FILES: { family: string; weight: string; file: string }[] = [
  { family: "Orbitron", weight: "900", file: "Orbitron-900.ttf" },
  { family: "Anton", weight: "400", file: "Anton-Regular.ttf" },
  { family: "Bebas Neue", weight: "400", file: "BebasNeue-Regular.ttf" },
  { family: "Rajdhani", weight: "700", file: "Rajdhani-700.ttf" },
  { family: "Playfair Display", weight: "800", file: "PlayfairDisplay-800.ttf" },
  { family: "Montserrat", weight: "800", file: "Montserrat-800.ttf" },
  { family: "Oswald", weight: "600", file: "Oswald-600.ttf" },
  { family: "Archivo Black", weight: "400", file: "ArchivoBlack-Regular.ttf" },
  { family: "Barlow Condensed", weight: "600", file: "BarlowCondensed-600.ttf" },
  { family: "Cinzel", weight: "700", file: "Cinzel-700.ttf" },
  { family: "Teko", weight: "700", file: "Teko-700.ttf" },
  { family: "Russo One", weight: "400", file: "RussoOne-Regular.ttf" },
  { family: "Michroma", weight: "400", file: "Michroma-Regular.ttf" },
  { family: "Italiana", weight: "400", file: "Italiana-Regular.ttf" },
  { family: "Righteous", weight: "400", file: "Righteous-Regular.ttf" },
  { family: "Alfa Slab One", weight: "400", file: "AlfaSlabOne-Regular.ttf" },
];

let loader: Promise<void> | null = null;

/** Muat semua font bundel sekali saja (aman dipanggil berulang). */
export function ensureAppFonts(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!loader) {
    loader = (async () => {
      try {
        const base = document.baseURI;
        const jobs: Promise<unknown>[] = [];
        for (const f of FONT_FILES) {
          try {
            const url = new URL(`fonts/${f.file}`, base).href;
            const ff = new FontFace(f.family, `url(${url})`, { weight: f.weight, display: "swap" });
            document.fonts.add(ff);
            jobs.push(ff.load());
          } catch {
            /* satu font gagal -> lanjut font lain */
          }
        }
        await Promise.allSettled(jobs);
        await document.fonts.ready;
      } catch {
        /* font gagal -> canvas tetap jalan dengan fallback */
      }
    })();
  }
  return loader;
}
