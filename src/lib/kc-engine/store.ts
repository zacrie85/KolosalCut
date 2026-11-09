// NOVACUT Studio - Zustand store (state proyek editing)

import { create } from "zustand";
import { uid } from "./constants";
import { PLAYLIST_ENHANCE_DEFAULTS } from "./playlistExport";
import type { AssetListName, BatchJobView, Clip, CoverConfig, ExportResult, ExportSettings, ExportState, MediaAsset, PlaylistExportConfig, ProjectMeta, Ratio, TextData, TextsConfig, Track, TrackKind, UiMode } from "./types";

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
}

export function dimsFor(ratio: Ratio, quality: 720 | 1080): { width: number; height: number } {
  return ratio === "9:16" ? { width: quality, height: Math.round((quality * 16) / 9) } : { width: Math.round((quality * 16) / 9), height: quality };
}

/** Klip visual paling atas yang aktif pada waktu t (video/gambar) */
export function activeVisualClipAt(state: { tracks: Track[]; clips: Clip[] }, t: number): Clip | undefined {
  let found: Clip | undefined;
  for (const track of state.tracks) {
    if (track.kind === "audio" || track.kind === "text" || track.hidden) continue;
    const active = state.clips
      .filter((c) => c.trackId === track.id && c.start <= t && t < c.start + c.duration)
      .sort((a, b) => a.start - b.start)
      .pop();
    if (active) found = active;
  }
  return found;
}

function makeTrack(kind: TrackKind, name: string): Track {
  return { id: uid("tr"), kind, name, muted: false, hidden: false };
}

function defaultTracks(): Track[] {
  return [makeTrack("video", "Video 1"), makeTrack("image", "Gambar 1"), makeTrack("text", "Teks 1"), makeTrack("audio", "Audio 1")];
}

const emptyExport: ExportState = { running: false, label: "", progress: 0, results: [], batchTotal: 0, batchIndex: 0 };

export interface EditorState {
  project: ProjectMeta;
  assets: MediaAsset[];
  tracks: Track[];
  clips: Clip[];
  playhead: number;
  playing: boolean;
  selectedClipId: string | null;
  zoom: number; // px per detik
  snap: boolean;
  texts: TextsConfig;
  /** pratinjau langsung tulisan judul/deskripsi/part di kanvas preview (menu Teks) */
  textPreview: boolean;
  cover: CoverConfig;
  exportSettings: ExportSettings;
  exportState: ExportState;
  /** setelan khusus export langsung dari Playlist */
  playlistExport: PlaylistExportConfig;

  /** ==== DUA DAFTAR PLAYLIST TERPISAH ====
   * "editor" = video yang akan dikelola di timeline (video editor),
   * "export" = video yang langsung di Export & Split tanpa lewat editor */
  editorList: string[];
  exportList: string[];
  /** status per-video saat batch export paralel berjalan (progres per baris) */
  batchJobs: BatchJobView[];

  // ===== KolosalCut v1.4.0 — ekstensi mesin =====
  kcFrame: { key: string; bars: boolean; barH: number };
  kcCancel: { all: boolean; ids: string[]; stamp: number };
  // v1.4.4: kcDisableTurbo DIHAPUS — mesin Turbo kini SELALU dipakai bila
  // video didukung, termasuk saat setelan EKSPORT "Render Penuh". Turbo
  // menggambar SEMUA gaya (cover, teks, bingkai, frame neon, teks otomatis)
  // lewat composeFrame yang sama dengan mesin kilat, jadi mematikannya hanya
  // membuat render 2-20x lebih lambat tanpa keuntungan hasil sama sekali.
  kcLabelTpl: string;
  kcSub: { size: number; posY: number; bg: "bar" | "none" };
  kcDesc: null | { text: string; size: number; relX: number; relY: number; font: string };
  /** mode tampilan aplikasi: layar sambutan / mode sederhana / mode pro */
  uiMode: UiMode;

  setUiMode: (m: UiMode) => void;
  addToAssetList: (list: AssetListName, ids: string[]) => void;
  removeFromAssetList: (list: AssetListName, id: string) => void;
  moveInAssetList: (list: AssetListName, from: number, to: number) => void;
  transferAsset: (from: AssetListName, id: string) => void;
  clearAssetList: (list: AssetListName) => void;
  setBatchJobs: (jobs: BatchJobView[]) => void;
  patchBatchJob: (id: string, p: Partial<BatchJobView>) => void;
  clearBatchJobs: () => void;

  setProject: (p: Partial<ProjectMeta>) => void;
  setRatio: (r: Ratio) => void;
  setQuality: (q: 720 | 1080) => void;
  addAsset: (a: MediaAsset) => void;
  removeAsset: (id: string) => void;
  getAsset: (id?: string) => MediaAsset | undefined;

  addTrack: (kind: TrackKind) => void;
  removeTrack: (id: string) => void;
  toggleMute: (id: string) => void;
  toggleHidden: (id: string) => void;

  addClipFromAsset: (assetId: string, opts?: { trackId?: string; start?: number; duration?: number }) => string | null;
  addTextClip: (text: Partial<TextData>, opts?: { trackId?: string; start?: number; duration?: number }) => string | null;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  moveClip: (id: string, start: number, trackId?: string) => void;
  splitClip: (id: string, t: number) => void;
  deleteClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  setClipSpeed: (id: string, speed: number) => void;
  setClipLoop: (id: string, n: number) => void;
  setClipZoom: (id: string, zoom: number) => void;
  nudgeClipPan: (id: string, dx: number, dy: number) => void;
  setClipPan: (id: string, x: number, y: number) => void;
  resetClipFraming: (id: string) => void;
  setClipTransition: (id: string, type: string | null, duration?: number) => void;
  toggleClipEffect: (id: string, fx: string) => void;
  clearClipEffects: (id: string) => void;

  setPlayhead: (t: number) => void;
  setPlaying: (v: boolean) => void;
  select: (id: string | null) => void;
  setZoom: (z: number) => void;
  toggleSnap: () => void;

  setTexts: (p: Partial<TextsConfig>) => void;
  setTextPreview: (v: boolean) => void;
  setCover: (p: Partial<CoverConfig>) => void;
  setExportSettings: (p: Partial<ExportSettings>) => void;
  setPlaylistExport: (p: Partial<PlaylistExportConfig>) => void;
  patchExportState: (p: Partial<ExportState>) => void;
  addExportResult: (r: ExportResult) => void;
  clearExportResults: () => void;
  removeExportResult: (id: string) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: { name: "Proyek Tanpa Judul", width: 1280, height: 720, ratio: "16:9" as Ratio, quality: 720 as 720 | 1080 },
  assets: [],
  tracks: defaultTracks(),
  clips: [],
  playhead: 0,
  playing: false,
  selectedClipId: null,
  zoom: 60,
  snap: true,
  texts: { title: "", description: "", labelStyle: "Part", parts: 5 },
  textPreview: true,
  cover: { frameTime: 0, templateId: "impact--cyber", duration: 3, useAI: true, mode: "auto" as const, bgStyle: "adegan" as const, bgScope: "sama" as const, frameStyle: "none" as const },
  exportSettings: {
    mode: "split",
    splitBy: "duration",
    parts: 5,
    partSeconds: 30,
    includeCover: true,
    coverDuration: 3,
    autoPartText: true,
    showTitleText: false,
    exportDir: "",
    engineMode: "fast",
    autoSub: false,
    subLevel: "ringan",
  },
  exportState: emptyExport,
  playlistExport: {
    autoTitle: true,
    titleCustom: "",
    description: "",
    labelStyle: "Part",
    showTitleScreen: true,
    showPartText: true,
    titleDuringVideo: true,
    ratio: "16:9" as Ratio,
    fitMode: "fill" as const,
    enhance: { ...PLAYLIST_ENHANCE_DEFAULTS },
    autoSub: false,
    subLevel: "ringan" as const,
    parallel: 3,
    quality: "tajam" as const,
    smartSplit: false,
    skipExisting: true,
    soundDone: true,
    autoShutdown: false,
  },
  editorList: [],
  exportList: [],
  batchJobs: [],
  uiMode: "welcome",

  // ===== KolosalCut v1.4.0 — ekstensi mesin (jangan diubah NOVACUT) =====
  /** frame overlay neon/minimalis + bar sinema — digambar engine pasca-klip */
  kcFrame: { key: "none", bars: false, barH: 0 },
  /** pembatalan batch: semua / id video tertentu (dipakai tombol BATALKAN) */
  kcCancel: { all: false, ids: [] as string[], stamp: 0 },
  // v1.4.4: kcDisableTurbo dihapus — lihat catatan di tipe state di atas
  /** template label kustom KolosalCut, mis. "BAGIAN KE-{n}" (kosong = gaya NOVACUT) */
  kcLabelTpl: "",
  /** gaya teks otomatis KolosalCut: ukuran fraksi tinggi + posisi Y fraksi (0..1) */
  kcSub: { size: 0.028, posY: 0.75, bg: "bar" as const },
  /** deskripsi sebagai teks terpisah di bawah (elemen Deskripsi KolosalCut) */
  kcDesc: null as null | { text: string; size: number; relX: number; relY: number; font: string },

  setUiMode: (m) => set({ uiMode: m }),

  addToAssetList: (list, ids) =>
    set((s) => {
      const cur = list === "editor" ? s.editorList : s.exportList;
      const add = ids.filter((id) => !cur.includes(id));
      return list === "editor" ? { editorList: [...cur, ...add] } : { exportList: [...cur, ...add] };
    }),

  removeFromAssetList: (list, id) =>
    set((s) =>
      list === "editor"
        ? { editorList: s.editorList.filter((x) => x !== id) }
        : { exportList: s.exportList.filter((x) => x !== id) }
    ),

  moveInAssetList: (list, from, to) =>
    set((s) => {
      const cur = [...(list === "editor" ? s.editorList : s.exportList)];
      if (from < 0 || from >= cur.length || to < 0 || to >= cur.length || from === to) return {};
      const [item] = cur.splice(from, 1);
      cur.splice(to, 0, item);
      return list === "editor" ? { editorList: cur } : { exportList: cur };
    }),

  transferAsset: (from, id) =>
    set((s) => {
      if (from === "editor") {
        if (!s.editorList.includes(id)) return {};
        return { editorList: s.editorList.filter((x) => x !== id), exportList: [...s.exportList, id] };
      }
      if (!s.exportList.includes(id)) return {};
      return { exportList: s.exportList.filter((x) => x !== id), editorList: [...s.editorList, id] };
    }),

  clearAssetList: (list) => set(list === "editor" ? { editorList: [] } : { exportList: [] }),

  setBatchJobs: (jobs) => set({ batchJobs: jobs }),
  patchBatchJob: (id, p) => set((s) => ({ batchJobs: s.batchJobs.map((j) => (j.id === id ? { ...j, ...p } : j)) })),
  clearBatchJobs: () => set({ batchJobs: [] }),

  setProject: (p) => set((s) => ({ project: { ...s.project, ...p } })),

  setRatio: (r) =>
    set((s) => {
      const dims = dimsFor(r, s.project.quality);
      return { project: { ...s.project, ratio: r, ...dims } };
    }),

  setQuality: (q) =>
    set((s) => {
      const dims = dimsFor(s.project.ratio, q);
      return { project: { ...s.project, quality: q, ...dims } };
    }),

  addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),

  removeAsset: (id) =>
    set((s) => ({
      assets: s.assets.filter((a) => a.id !== id),
      clips: s.clips.filter((c) => c.assetId !== id),
      editorList: s.editorList.filter((x) => x !== id),
      exportList: s.exportList.filter((x) => x !== id),
    })),

  getAsset: (id) => (id ? get().assets.find((a) => a.id === id) : undefined),

  addTrack: (kind) =>
    set((s) => {
      const count = s.tracks.filter((t) => t.kind === kind).length + 1;
      const labelMap: Record<TrackKind, string> = { video: "Video", image: "Gambar", text: "Teks", audio: "Audio" };
      const t = makeTrack(kind, `${labelMap[kind]} ${count}`);
      // track baru untuk video/gambar/teks ditambahkan paling atas render (sebelum track video pertama? paling akhir = paling atas)
      const idx = s.tracks.findIndex((x) => x.kind === "audio");
      const arr = [...s.tracks];
      if (kind === "audio" || idx === -1) arr.push(t);
      else arr.splice(idx, 0, t);
      return { tracks: arr };
    }),

  removeTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      clips: s.clips.filter((c) => c.trackId !== id),
    })),

  toggleMute: (id) => set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)) })),
  toggleHidden: (id) => set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)) })),

  addClipFromAsset: (assetId, opts) => {
    const st = get();
    const asset = st.assets.find((a) => a.id === assetId);
    if (!asset) return null;
    const kind: Clip["kind"] = asset.type === "video" ? "video" : asset.type === "audio" ? "audio" : "image";
    let trackId = opts?.trackId;
    if (!trackId) {
      const match = st.tracks.filter((t) => (asset.type === "video" ? t.kind === "video" : asset.type === "audio" ? t.kind === "audio" : t.kind === "image" || t.kind === "video"));
      const withClips = match.filter((t) => st.clips.some((c) => c.trackId === t.id));
      trackId = (withClips.length ? withClips[withClips.length - 1] : match[0])?.id;
    }
    if (!trackId) return null;
    const trackClips = st.clips.filter((c) => c.trackId === trackId);
    const start = opts?.start ?? trackClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const duration = opts?.duration ?? (asset.type === "image" ? 5 : Math.max(0.2, asset.duration));
    const clip: Clip = {
      id: uid("cl"),
      trackId,
      kind,
      assetId,
      start,
      duration,
      inPoint: 0,
      speed: 1,
      loopCount: 1,
      volume: 1,
      fadeIn: asset.type === "audio" ? 0.4 : 0,
      fadeOut: asset.type === "audio" ? 0.8 : 0,
      effects: [],
      zoom: 1,
      panX: 0,
      panY: 0,
    };
    set((s) => ({ clips: [...s.clips, clip], selectedClipId: clip.id }));
    return clip.id;
  },

  addTextClip: (text, opts) => {
    const st = get();
    const trackId = opts?.trackId ?? st.tracks.find((t) => t.kind === "text")?.id;
    if (!trackId) return null;
    const clip: Clip = {
      id: uid("cl"),
      trackId,
      kind: "text",
      start: opts?.start ?? st.playhead,
      duration: opts?.duration ?? 4,
      inPoint: 0,
      speed: 1,
      loopCount: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      effects: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      text: {
        content: text.content ?? "Teks Baru",
        sub: text.sub,
        size: text.size ?? 0.09,
        color: text.color ?? "#ffffff",
        font: text.font ?? "condensed",
        anim: text.anim ?? "rise",
        pos: text.pos ?? "bottom",
        bg: text.bg ?? "none",
        stroke: text.stroke ?? true,
      },
    };
    set((s) => ({ clips: [...s.clips, clip], selectedClipId: clip.id }));
    return clip.id;
  },

  updateClip: (id, patch) => set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

  moveClip: (id, start, trackId) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, start: Math.max(0, start), trackId: trackId ?? c.trackId } : c)),
    })),

  splitClip: (id, t) => {
    const st = get();
    const clip = st.clips.find((c) => c.id === id);
    if (!clip) return;
    const end = clip.start + clip.duration;
    if (t <= clip.start + 0.05 || t >= end - 0.05) return;
    const leftDur = t - clip.start;
    const srcSeg = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
    const rightIn = clip.loopCount > 1 ? clip.inPoint + ((leftDur * clip.speed) % Math.max(0.04, srcSeg)) : clip.inPoint + leftDur * clip.speed;
    const left: Clip = { ...clip, duration: leftDur, fadeOut: 0 };
    const right: Clip = {
      ...clip,
      id: uid("cl"),
      start: t,
      duration: end - t,
      inPoint: rightIn,
      transition: undefined,
      fadeIn: 0,
      label: clip.label,
    };
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? left : c)).concat(right), selectedClipId: right.id }));
  },

  deleteClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id), selectedClipId: s.selectedClipId === id ? null : s.selectedClipId })),

  duplicateClip: (id) => {
    const st = get();
    const clip = st.clips.find((c) => c.id === id);
    if (!clip) return;
    const copy: Clip = { ...clip, id: uid("cl"), start: clip.start + clip.duration };
    set((s) => ({ clips: [...s.clips, copy], selectedClipId: copy.id }));
  },

  setClipSpeed: (id, speed) =>
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        const sp = Math.max(0.25, Math.min(4, speed));
        const srcSeg = (c.duration * c.speed) / Math.max(1, c.loopCount);
        const newDur = Math.max(0.2, Math.min(600, srcSeg / sp));
        return { ...c, speed: sp, duration: newDur };
      }),
    })),

  setClipLoop: (id, n) =>
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        const nn = Math.max(1, Math.min(10, Math.round(n)));
        const newDur = Math.max(0.2, Math.min(600, c.duration * (nn / Math.max(1, c.loopCount))));
        return { ...c, loopCount: nn, duration: newDur };
      }),
    })),

  setClipZoom: (id, zoom) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, zoom: Math.max(1, Math.min(5, Math.round(zoom * 100) / 100)) } : c)),
    })),

  nudgeClipPan: (id, dx, dy) =>
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        const px = Math.max(-1, Math.min(1, (c.panX ?? 0) + dx));
        const py = Math.max(-1, Math.min(1, (c.panY ?? 0) + dy));
        return { ...c, panX: Math.abs(px) < 0.02 ? 0 : px, panY: Math.abs(py) < 0.02 ? 0 : py };
      }),
    })),

  setClipPan: (id, x, y) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, panX: Math.max(-1, Math.min(1, x)), panY: Math.max(-1, Math.min(1, y)) } : c)),
    })),

  resetClipFraming: (id) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, zoom: 1, panX: 0, panY: 0 } : c)) })),

  setClipTransition: (id, type, duration) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, transition: type ? { type, duration: duration ?? c.transition?.duration ?? 0.6 } : undefined } : c
      ),
    })),

  toggleClipEffect: (id, fx) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, effects: c.effects.includes(fx) ? c.effects.filter((e) => e !== fx) : [...c.effects, fx] } : c
      ),
    })),

  clearClipEffects: (id) => set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, effects: [] } : c)) })),

  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (v) => set({ playing: v }),
  select: (id) => set({ selectedClipId: id }),
  setZoom: (z) => set({ zoom: Math.max(10, Math.min(240, z)) }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),

  setTexts: (p) => set((s) => ({ texts: { ...s.texts, ...p } })),
  setTextPreview: (v) => set({ textPreview: v }),
  setCover: (p) => set((s) => ({ cover: { ...s.cover, ...p } })),
  setExportSettings: (p) => set((s) => ({ exportSettings: { ...s.exportSettings, ...p } })),
  setPlaylistExport: (p) => set((s) => ({ playlistExport: { ...s.playlistExport, ...p } })),
  patchExportState: (p) => set((s) => ({ exportState: { ...s.exportState, ...p } })),
  addExportResult: (r) => set((s) => ({ exportState: { ...s.exportState, results: [...s.exportState.results, r] } })),
  clearExportResults: () => set((s) => ({ exportState: { ...s.exportState, results: [] } })),
  removeExportResult: (id) => set((s) => ({ exportState: { ...s.exportState, results: s.exportState.results.filter((r) => r.id !== id) } })),
}));

export function selectedClip(state: EditorState): Clip | undefined {
  return state.clips.find((c) => c.id === state.selectedClipId);
}

// hook debug/testing di browser console
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__NOVA__ = useEditor;
}
