// ============================================================
// KolosalCut v1.4.0 — JEMBATAN MESIN NOVACUT
// Tampilan & alur KolosalCut tetap sama; seluruh pengolahan video
// (render, split, cover, efek, transisi, teks, teks otomatis)
// kini dikerjakan MESIN NOVACUT (WebCodecs offscreen + antrean
// global per bagian + tulis langsung ke disk).
//
// Pemakaian:
//   const stop = subscribeKcBatch((snap) => ...);   // progres per video
//   await startKcBatch(items, settings, folder);    // mulai batch
//   cancelKcBatch({ all: true } | { id });          // BATALKAN
// ============================================================
import type { Settings } from "@/lib/video-config";
import { useEditor } from "./kc-engine/store";
import { runBatchExport } from "./kc-engine/exporter";
import { engine } from "./kc-engine/engine";
import { fastSupported } from "./kc-engine/fastExport";
import { preloadKcOverlay } from "./kc-engine/kc-overlays";
import type { BatchJobView, MediaAsset, SubLevel } from "./kc-engine/types";

// ============================================================
// Tipe publik
// ============================================================
export interface KcItem {
  /** id unik baris antrean KolosalCut (uid item) */
  id: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  /** objek File asli di renderer (blob URL item.objectUrl) */
  file: File;
  objectUrl: string;
  /** id unggahan server (untuk teks otomatis offline) */
  uploadId?: string;
  /** snapshot setelan video ini */
  settings: Settings;
}

export interface KcJobView {
  id: string;
  name: string;
  status: "antre" | "jalan" | "selesai" | "gagal" | "batal";
  progress: number;
  label?: string;
}

export interface KcBatchSnap {
  running: boolean;
  progress: number;
  label: string;
  eta?: number;
  jobs: KcJobView[];
  /** daftar file hasil (nama + path bila langsung tersimpan) */
  results: { name: string; size: number; savedPath?: string; kcJobId?: string }[];
}

type SnapCb = (s: KcBatchSnap) => void;

let unsub: (() => void) | null = null;
let running = false;

// ============================================================
// Pemetaan gaya KolosalCut -> NOVACUT
// ============================================================
const FONT_MAP: Record<string, string> = {
  anton: "impact",
  bebas: "condensed",
  oswald: "oswald",
  montserrat: "montserrat",
  playfair: "serif",
  cinzel: "cinzel",
  archivo: "archivo",
  carlito: "sans",
  // v1.4.2 — 8 font baru ala NOVACUT → alias TEXT_FONTS mesin
  teko: "teko",
  barlow: "barlow",
  rajdhani: "sans",
  russo: "russo",
  orbitron: "display",
  michroma: "michroma",
  righteous: "righteous",
  alfaslab: "alfaslab",
};

function kcFont(k: string): string {
  return FONT_MAP[k] || "condensed";
}

/**
 * v1.4.2 — BARIS GABUNG gaya cover NOVACUT:
 *   "<deskripsi> · <Part/Episode> {n}/{total}"
 * persis referensi "SHORT DRAMA MOVIES SERIES · Episode 2/30".
 * Bila deskripsi kosong → "Episode {n}/{total}" saja. Huruf dipertahankan
 * apa adanya (tidak dipaksa KAPITAL) agar gaya bebas seperti di NOVACUT.
 */
function mergedCoverLine(s: Settings, labelStyle: string): string {
  const word =
    s.label.format === "custom"
      ? ""
      : s.label.format === "episode"
        ? "Episode"
        : s.label.format === "bagian"
          ? "Bagian"
          : s.label.format === "eps"
            ? "Eps"
            : "Part";
  void labelStyle;
  const num = `${word ? word + " " : ""}{n}/{total}`;
  const desc = s.desc.enabled ? s.desc.text.trim() : "";
  return desc ? `${desc} · ${num}` : num;
}

/** bitrate sesuai kualitas KolosalCut: ringan 4,5 Mbps / tajam 9 / maksimal 14 */
function bitrateFor(q: string): number {
  return q === "fast" ? 4_500_000 : q === "high" ? 14_000_000 : 9_000_000;
}

/** mode whisper-cli: sangat-cepat / cepat / akurat */
function subLevelFor(mode: string): SubLevel {
  return mode === "akurat" ? "akurat" : mode === "cepat" ? "sedang" : "ringan";
}

// ============================================================
// Mulai batch
// ============================================================
export async function startKcBatch(
  items: KcItem[],
  s: Settings,
  callbacks: SnapCb
): Promise<void> {
  if (running || !items.length) return;
  running = true;

  const ed = useEditor.getState();
  const support = await fastSupported();
  const target = { width: 1080, height: 1920 }; // KolosalCut selalu 9:16 1080x1920

  // ---- status proyek & ukuran ----
  useEditor.setState({
    project: { name: "KolosalCut", ...target, ratio: "9:16" as const, quality: 1080 as const },
  });
  engine.syncSize();

  // ---- aset video (File lokal + blob URL — nol copy) ----
  const assets: MediaAsset[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    type: "video" as const,
    url: it.objectUrl,
    duration: it.duration,
    width: it.width,
    height: it.height,
    file: it.file,
    ...(it.uploadId ? { kcUploadId: it.uploadId } : {}),
  }));

  // ---- aset cover manual (gambar unggahan) ----
  if (s.coverEnabled && s.coverMode === "manual" && s.coverImage) {
    assets.push({
      id: `${items[0].id}-cover-manual`,
      name: "Cover Unggahan",
      type: "image",
      url: s.coverImage,
      duration: 0,
      width: target.width,
      height: target.height,
    });
  }
  useEditor.setState({ assets });

  // ---- setelan teks (judul/deskripsi/label) ----
  const labelStyle = ((): "Part" | "Episode" | "Bagian" | "Eps" | "EP" => {
    switch (s.label.format) {
      case "episode": return "Episode";
      case "bagian": return "Bagian";
      case "eps": return "Eps";
      default: return "Part";
    }
  })();
  useEditor.setState({
    texts: {
      title: s.title.text || "",
      // v1.4.2: di gaya NOVACUT deskripsi ikut BARIS GABUNG label — kosongkan
      // di sini agar baris sub cover tidak menjadi "desc · desc · Episode n"
      description: s.coverTextNovacut ? "" : s.desc.enabled ? s.desc.text : "",
      labelStyle,
      parts: Math.max(1, s.splitParts),
      // ukuran huruf: KolosalCut memakai px pada kanvas 1080x1920 → fraksi tinggi
      titleSize: Math.max(0.012, Math.min(0.2, s.title.size / 1920)),
      descSize: Math.max(0.012, Math.min(0.2, s.desc.size / 1920)),
      partSize: Math.max(0.012, Math.min(0.2, s.label.size / 1920)),
      fontAuto: kcFont(s.title.font),
      // posisi bebas KolosalCut -> offset NOVACUT (anchor top=0.16h/center=0.5h/bottom=0.86h)
      titleX: Math.round((s.title.relX - 0.5) * 100),
      // v1.4.3: LAYAR COVER TETAP seperti sebelumnya — posisi judul di cover
      // dibekukan di anchor lama (relY lama 0.055 -> -7) karena slider POSISI
      // VERTIKAL baru hanya menggeser tulisan saat video berjalan
      titleY: -7,
      descX: Math.round((s.desc.relX - 0.5) * 100),
      descY: Math.round(Math.max(-45, Math.min(45, (s.desc.relY + 0.02 - 0.86) * 100))),
      partX: Math.round((s.label.relX - 0.5) * 100),
      // v1.4.3: partY tidak lagi dipakai — posisi part kini lewat partV (langsung 0..100)
      partY: 0,
      // v1.4.3: posisi vertikal LANGSUNG saat video berjalan (0 = paling atas,
      // 100 = paling bawah) — dari drag pratinjau / slider Posisi Vertikal.
      // Judul+deskripsi DEFAULT di PALING BAWAH (relY 0.955), part DI ATAS (0.055)
      titleV: Math.round(Math.max(0, Math.min(100, s.title.relY * 100))),
      partV: Math.round(Math.max(0, Math.min(100, s.label.relY * 100))),
      // v1.4.3: bingkai judul (10 gaya) + skala ukuran otomatis/manual
      titleFrame: s.titleFrame || "",
      titleFrameW: s.titleFrameW,
      titleFrameH: s.titleFrameH,
    },
    // v1.4.2 — GAYA COVER NOVACUT: judul di ATAS, deskripsi + part/episode
    // SEBARIS ("deskripsi · Episode n/total") tepat di bawah judul — persis
    // cover referensi "SHORT DRAMA MOVIES SERIES · Episode 2/30". Baris gabung
    // dibawa oleh template label kustom ({n}/{total} diganti mesin) sehingga
    // muncul di sub cover MAUPUN label isi video; elemen deskripsi terpisah
    // dimatikan agar tidak dobel.
    ...(s.coverTextNovacut
      ? {
          kcLabelTpl: mergedCoverLine(s, labelStyle),
          kcDesc: null,
        }
      : {
          kcLabelTpl: s.label.format === "custom" ? s.label.prefix || "" : "",
          kcDesc: s.desc.enabled && s.desc.text
            ? { text: s.desc.text, size: s.desc.size, relX: s.desc.relX, relY: s.desc.relY, font: kcFont(s.desc.font) }
            : null,
        }),
    kcSub: {
      size: s.subtitle.style === "klasik" ? 0.028 : 0.036,
      posY: s.subtitle.posY,
      bg: s.subtitle.style === "klasik" ? ("none" as const) : ("bar" as const),
    },
  });

  // ---- cover ala NOVACUT (100 template) ----
  const legacyCover = s.coverTemplate === "legacy";
  const manualAssetId =
    s.coverEnabled && s.coverMode === "manual" && s.coverImage
      ? `${items[0].id}-cover-manual`
      : undefined;
  useEditor.setState({
    cover: {
      frameTime: s.coverPos === "tengah" ? 0.5 : 0.12,
      templateId: legacyCover ? "impact--cyber" : s.coverTemplate,
      duration: Math.max(2, Math.min(5, s.coverDuration)),
      useAI: true,
      mode: s.coverMode === "manual" ? ("manual" as const) : ("auto" as const),
      ...(manualAssetId ? { manualAssetId } : {}),
      manualPlain: s.coverManualPlain,
      bgStyle: legacyCover ? ("hitam" as const) : s.coverBg,
      bgScope: s.coverSame ? ("sama" as const) : ("beda" as const),
      frameStyle: s.coverFrameStyle,
    },
  });

  // ---- setelan export & split ----
  useEditor.setState({
    exportSettings: {
      mode: s.splitMode === "off" ? ("single" as const) : ("split" as const),
      // v1.4.7 FIX SPLIT 64 vs 30 — splitBy WAJIB mengikuti pilihan pengguna:
      // dulu selalu "duration" walau pengguna memilih "Berapa bagian" → angka
      // bagian (mis. 30) DIABAIKAN, video dipotong per partSeconds (60 dtk)
      // dan film ±64 menit menjadi 64 video. Kini:
      //   "Berapa bagian"    → splitBy "count"   = tepat N file hasil
      //   "Durasi per video" → splitBy "duration" = potong tiap N detik
      splitBy: s.splitMode === "parts" ? ("count" as const) : ("duration" as const),
      parts: Math.max(1, Math.min(50, s.splitParts)),
      partSeconds: Math.max(3, Math.min(3600, s.splitSeconds)),
      includeCover: s.coverEnabled,
      coverDuration: Math.max(2, Math.min(5, s.coverDuration)),
      autoPartText: s.label.enabled,
      showTitleText: s.title.enabled,
      exportDir: s.outputDir || "",
      engineMode: "fast" as const,
      autoSub: s.subtitle.enabled,
      subLevel: subLevelFor(s.subtitle.mode),
    },
    playlistExport: {
      autoTitle: !s.title.text.trim(), // judul kosong → dari nama video
      titleCustom: s.title.text.trim(),
      // v1.4.2: di gaya cover NOVACUT deskripsi sudah MENEMPAT DIRI di baris
      // gabung label ("desc · Episode n/total") — kosongkan di sini agar baris
      // sub cover tidak menjadi "desc · desc · Episode n" (dobel).
      description: s.coverTextNovacut ? "" : s.desc.enabled ? s.desc.text : "",
      labelStyle,
      showTitleScreen: s.coverEnabled,
      showPartText: s.label.enabled,
      titleDuringVideo: true,
      ratio: "9:16" as const,
      fitMode: s.ratio === "fit" ? ("fit" as const) : ("fill" as const),
      enhance: {
        enabled: true,
        speed: Math.max(0.25, Math.min(4, s.speed)),
        loopCount: Math.max(1, Math.min(10, Math.round(s.loopCount))),
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        effects: [...(s.effects || [])],
        transitionType: s.transitionType,
        transitionDuration: Math.max(0.2, Math.min(2, s.transitionDur)),
        zoom: Math.max(1, Math.min(5, s.zoom)),
        panX: Math.max(-1, Math.min(1, (s.panX - 0.5) * 2)),
        panY: Math.max(-1, Math.min(1, (s.panY - 0.5) * 2)),
      },
      autoSub: s.subtitle.enabled,
      subLevel: subLevelFor(s.subtitle.mode),
      // v1.4.4: fallback 5 — export & split setara NOVACUT Studio v1.0.22
      parallel: Math.max(1, Math.min(7, Number(s.parallel) || 5)),
      quality: bitrateFor(s.quality) >= 14_000_000 ? "maksimal" : bitrateFor(s.quality) <= 4_500_000 ? "ringan" : "tajam",
      smartSplit: false,
      skipExisting: true,
      soundDone: false,
      autoShutdown: false,
    },
  });

  // ---- overlay frame neon + bar sinema + saklar mesin ----
  useEditor.setState({
    kcFrame: { key: s.frame, bars: s.bars, barH: s.bars ? barHeightOf(s) : 0 },
    // v1.4.4: saklar kcDisableTurbo DIHAPUS — setelan EKSPORT "Render Penuh"
    // TIDAK lagi mematikan mesin Turbo. Turbo menggambar semua gaya lewat
    // composeFrame yang sama persis dgn mesin kilat (satu jalur sejak
    // v1.4.3), jadi hasilnya identik tapi 2-20x lebih cepat. Dulu setelan
    // ini membuat pengguna "Render Penuh" tanpa sadar jatuh ke mesin lama
    // yang lambat — itulah penyebab export 4-9 jam pada video panjang.
    kcCancel: { all: false, ids: [], stamp: Date.now() },
  });
  // v1.4.2: TUNGGU overlay siap — dulu hanya "dipanaskan" tanpa menunggu,
  // frame-frame awal render bisa tanpa neon lalu neon muncul mendadak
  // (= salah satu penyebab tampilan berkedip).
  await preloadKcOverlay(useEditor.getState().kcFrame);

  // ---- status batch awal ----
  useEditor.setState({
    batchJobs: items.map<KcBatchJob>((it) => ({
      id: it.id,
      name: it.name,
      status: "antre",
      progress: 0,
      label: "Menunggu giliran render...",
    })),
    // PENTING: running HARUS false — runBatchExport yang menaikkan sendiri
    // (guard-nya mengabaikan pemanggilan bila running masih true)
    exportState: {
      running: false,
      label: `${items.length} video siap — mesin NOVACUT dimulai...`,
      progress: 0,
      results: [],
      batchTotal: items.length,
      batchIndex: 0,
    },
  });

  // ---- pompa status -> UI KolosalCut ----
  unsubscribeKcBatch();
  unsub = useEditor.subscribe((st) => {
    callbacks({
      running: st.exportState.running,
      progress: st.exportState.progress,
      label: st.exportState.label,
      eta: st.exportState.eta,
      jobs: st.batchJobs.map((j) => ({
        ...j,
        status: j.label === "Dibatalkan" ? ("batal" as const) : j.status,
      })),
      results: st.exportState.results.map((r) => ({
        name: r.name,
        size: r.size,
        ...(r.savedPath ? { savedPath: r.savedPath } : {}),
        ...(r.kcJobId ? { kcJobId: r.kcJobId } : {}),
      })),
    });
  });

  try {
    if (!support) {
      throw new Error("Perangkat ini tidak mendukung mesin render (WebCodecs). Perbarui aplikasi/browser.");
    }
    await runBatchExport(items.map((it) => it.id));
  } finally {
    running = false;
    const st = useEditor.getState();
    callbacks({
      running: false,
      progress: st.exportState.progress,
      label: st.exportState.label,
      eta: st.exportState.eta,
      jobs: st.batchJobs.map((j) => ({
        ...j,
        status: j.label === "Dibatalkan" ? ("batal" as const) : j.status,
      })),
      results: st.exportState.results.map((r) => ({
        name: r.name,
        size: r.size,
        ...(r.savedPath ? { savedPath: r.savedPath } : {}),
        ...(r.kcJobId ? { kcJobId: r.kcJobId } : {}),
      })),
    });
    // bersihkan elemen media antar batch (hemat memori/dekoder)
    engine.pruneElements();
    engine.pause();
  }
}

/** tinggi bar sinema (px pada 1920) — sama dengan BAR_H video-config */
function barHeightOf(s: Settings): number {
  return s.barSize === "kecil" ? 150 : s.barSize === "besar" ? 340 : 235;
}

type KcBatchJob = BatchJobView;

// ============================================================
// Pembatalan
// ============================================================
export function cancelKcBatch(opts: { all?: boolean; id?: string }): void {
  const c = useEditor.getState().kcCancel;
  useEditor.setState({
    kcCancel: {
      all: opts.all ? true : c.all,
      ids: opts.id ? [...new Set([...c.ids, opts.id])] : c.ids,
      stamp: Date.now(),
    },
  });
}

export function resetKcCancel(): void {
  useEditor.setState({ kcCancel: { all: false, ids: [], stamp: Date.now() } });
}

export function isKcBatchRunning(): boolean {
  return running;
}

export function unsubscribeKcBatch(): void {
  if (unsub) {
    unsub();
    unsub = null;
  }
}
