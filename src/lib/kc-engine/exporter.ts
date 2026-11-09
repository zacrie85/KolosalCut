// NOVACUT Studio - Export & Split: dua mesin render
//  1) MODE KILAT (bawaan): WebCodecs offscreen — video TIDAK diputar, 5-10x lebih
//     cepat, bisa beberapa video sekaligus (paralel). Lihat fastExport.ts.
//     v1.0.17: MESIN TURBO (turboExport.ts) — decode WebCodecs murni + audio
//     stream-copy, dan antrean render GLOBAL PER BAGIAN (semua bagian dari
//     seluruh batch dirender bersamaan sesuai anggaran RAM, bukan per film).
//  2) MODE KOMPATIBEL: rekam real-time via MediaRecorder (jalur lama).
// Fitur: cover otomatis, teks judul/deskripsi/part, subtitle AI (bahasa Indonesia).

import { grabFrame, aiRecommendTemplates, analyzeVideoFrames, drawCoverFrame, loadImage, plainCoverDataURL, renderCoverToDataURL } from "./covers";
import { COVER_TEMPLATES, partLabel, slugify, uid } from "./constants";
import { engine } from "./engine";
import { adjustRangesToSilence, exportRangeFast, fastSupported, AudioDecodeCache } from "./fastExport";
import { ensureAppFonts } from "./fonts";
import { fileSizeInDir, isDesktopFS, notifyDesktop, saveBlobToDir, shutdownPC } from "./fsBridge";
import { normalizeEnhance } from "./playlistExport";
import { dimsFor, useEditor, totalDuration } from "./store";
import { transcribeAsset, type SubSegment } from "./kc-subtitles";
import { audioCopyAllowed, exportSegmentTurbo, releaseTurboParse, turboEligible } from "./turboExport";
import type { BatchJobView, Clip, CoverFrameStyle, MediaAsset, Track } from "./types";
import { fillZoomFor } from "./visual";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===== v1.0.16: bunyi "ting" — AudioContext dibuat sekali, dipakai sepanjang batch =====
let chimeCtx: AudioContext | null = null;
/** Bunyi pendek saat satu film selesai ("film") dan saat seluruh batch tuntas ("done") */
function chime(kind: "film" | "done") {
  try {
    chimeCtx ??= new AudioContext();
    if (chimeCtx.state === "suspended") void chimeCtx.resume();
    const t = chimeCtx.currentTime;
    const tones: [number, number][] = kind === "film" ? [[880, 0]] : [[659.25, 0], [987.77, 0.15]];
    for (const [freq, dt] of tones) {
      const o = chimeCtx.createOscillator();
      const g = chimeCtx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.18, t + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.4);
      o.connect(g);
      g.connect(chimeCtx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.45);
    }
  } catch {
    /* audio tidak tersedia — abaikan */
  }
}

/** batasi ukuran huruf relatif (0.012–0.2) dengan bawaan aman */
function clampPct(v: number | undefined, def: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : def;
  return Math.max(0.012, Math.min(0.2, n));
}

/** posisi geser teks (% layar, -45..45) -> fraksi (aman untuk data lama) */
function clampOffPct(v: number | undefined): number {
  const n = typeof v === "number" && isFinite(v) ? Math.round(v) : 0;
  return Math.max(-45, Math.min(45, n)) / 100;
}

/** v1.4.3: posisi vertikal langsung (% layar 0..100) -> fraksi 0..1.
 * Setelan lama tanpa nilai otomatis memakai default (judul = 100 bawah,
 * part = 0 atas) sesuai posisi bawaan baru. */
function clampV(v: number | undefined, def: number): number {
  const n = typeof v === "number" && isFinite(v) ? Math.round(v) : def;
  return Math.max(0, Math.min(100, n)) / 100;
}

// ============================================================
// KolosalCut v1.4.0 — jembatan gaya teks KolosalCut (posisi bebas 0..1)
// ============================================================
/** pilih anchor NOVACUT (top/center/bottom) dari posisi Y fraksi KolosalCut */
function kcAnchorFor(f: number): "top" | "center" | "bottom" {
  return f < 0.33 ? "top" : f < 0.66 ? "center" : "bottom";
}
/** hitung offY (fraksi tinggi) agar pusat blok teks jatuh di fraksi f.
 * anchor: top = 0.16h, center = 0.5h, bottom = 0.86h (drawTextOverlay). */
function kcOffYFor(f: number, estHalf = 0.03): number {
  const anchor = f < 0.33 ? 0.16 : f < 0.66 ? 0.5 : 0.86;
  return Math.max(-0.45, Math.min(0.45, f + estHalf - anchor));
}
/** offX dari relX KolosalCut (0..1, 0.5 = tengah) */
function kcOffXFor(f: number): number {
  return Math.max(-0.45, Math.min(0.45, f - 0.5));
}
/** label bagian: dukung template kustom KolosalCut (mis. "BAGIAN KE-{n}") */
function kcPartLabel(style: string, index: number, total: number, withTotal: boolean): string {
  const tpl = useEditor.getState().kcLabelTpl?.trim();
  if (tpl) {
    // v1.4.2: huruf TIDAK lagi dipaksa KAPITAL — baris gabung gaya cover
    // NOVACUT ("Short Drama Movies Series · Episode 2/30") harus tampil
    // apa adanya seperti ketikan pengguna.
    return tpl.replaceAll("{n}", String(index)).replaceAll("{total}", String(total));
  }
  return partLabel(style, index, total, withTotal);
}
/** apakah satu video dibatalkan pengguna (tombol BATALKAN KolosalCut) */
function kcCancelled(jid: string): boolean {
  const c = useEditor.getState().kcCancel;
  return c.all || c.ids.includes(jid);
}

/**
 * Petakan segmen subtitle (waktu SUMBER video) ke waktu timeline.
 * Memakai rumus kebalikan srcTime engine: t = clip.start + ((S - inPoint) % srcSeg) / speed
 */
function mapSubsToTimeline(segs: SubSegment[], clips: Clip[]): SubSegment[] {
  const out: SubSegment[] = [];
  const videoClips = clips.filter((c) => c.kind === "video").sort((a, b) => a.start - b.start);
  for (const seg of segs) {
    const mid = (seg.start + Math.max(seg.start, seg.end - 0.05)) / 2;
    const clip = videoClips.find((c) => {
      const srcSeg = (c.duration * c.speed) / Math.max(1, c.loopCount);
      return mid >= c.inPoint && mid < c.inPoint + Math.max(0.033, srcSeg);
    });
    if (!clip) continue;
    const srcSeg = Math.max(0.033, (clip.duration * clip.speed) / Math.max(1, clip.loopCount));
    const span = Math.max(0.2, seg.end - seg.start);
    const local = (t: number) => clip.start + (((t - clip.inPoint) % srcSeg + srcSeg) % srcSeg) / Math.max(0.25, clip.speed);
    const t0 = local(Math.max(clip.inPoint, seg.start));
    const t1 = t0 + span / Math.max(0.25, clip.speed);
    if (t1 - t0 < 0.2) continue;
    out.push({ start: t0, end: Math.min(t1, clip.start + clip.duration), text: seg.text });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Sisipkan klip teks SUBTITLE (waktu timeline) ke proyek mentah — dipakai mode
 * "export saja" (tanpa split) karena proyek itu tidak lewat buildSplitProject. */
function appendSubtitleClips(
  clips: Clip[],
  tracks: Track[],
  subs: SubSegment[]
): { clips: Clip[]; tracks: Track[] } {
  if (!subs.length) return { clips, tracks };
  const tt = ensureTextTrack(tracks);
  const fontAuto = useEditor.getState().texts.fontAuto || "condensed";
  // KolosalCut: gaya teks otomatis ikut setelan pengguna (ukuran & posisi Y)
  const kcSub = useEditor.getState().kcSub;
  const subSize = clampPct(kcSub.size, 0.028);
  const subPos = kcAnchorFor(kcSub.posY);
  const subOffY = kcOffYFor(kcSub.posY, 0.02);
  const extra: Clip[] = subs
    .filter((s) => s.end - s.start >= 0.25)
    .map((seg) =>
      baseClip({
        trackId: tt.textTrack.id,
        kind: "text",
        start: seg.start,
        duration: seg.end - seg.start,
        text: {
          content: seg.text,
          size: subSize,
          color: "#ffffff",
          font: fontAuto,
          anim: "fade",
          pos: subPos,
          bg: kcSub.bg,
          stroke: true,
          offY: subOffY,
        },
      })
    );
  return { clips: [...clips, ...extra], tracks: tt.tracks };
}

// MP4 diprioritaskan (H.264 + AAC untuk kompatibilitas terbaik,
// lalu H.264 + Opus, lalu default bawaan browser)
const MP4_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1,opus",
  "video/mp4",
];
const WEBM_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export interface ExportFormat {
  mime: string;
  ext: ".mp4" | ".webm";
  label: string;
}

let cachedFormat: ExportFormat | null = null;

/** Pilih format rekaman terbaik: MP4 dulu, WebM sebagai fallback */
export function pickExportFormat(): ExportFormat {
  if (cachedFormat) return cachedFormat;
  if (typeof MediaRecorder !== "undefined") {
    for (const mime of MP4_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(mime)) {
        cachedFormat = { mime, ext: ".mp4", label: "MP4 (H.264)" };
        return cachedFormat;
      }
    }
    for (const mime of WEBM_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(mime)) {
        cachedFormat = { mime, ext: ".webm", label: "WebM (VP9/VP8)" };
        return cachedFormat;
      }
    }
  }
  cachedFormat = { mime: "video/webm", ext: ".webm", label: "WebM" };
  return cachedFormat;
}

/** Rekam rentang timeline menjadi blob video (MP4/WebM) */
export async function exportRange(start: number, end: number, onProgress?: (p: number) => void): Promise<Blob> {
  const canvas = engine.canvas;
  if (!canvas) throw new Error("Canvas belum siap");
  await ensureAppFonts(); // pastikan font sinematik bundel siap sebelum merekam
  engine.ensureAudio();
  // Tunggu AudioContext siap MAKSIMAL 0.9 detik — di perangkat tanpa output audio
  // resume() bisa menggantung selamanya sehingga export macet di awal.
  await Promise.race([engine.audioCtx?.resume().catch(() => {}), sleep(900)]);
  await sleep(150);

  const fmt = pickExportFormat();
  const stream = engine.captureStream(30);
  if (!stream) throw new Error("Browser tidak mendukung perekaman canvas");
  // Sumber audio senyap: WAJIB agar track audio mengalir sejak detik pertama rekaman.
  // Tanpa ini muxer MP4 baru "mengunci" timeline saat sampel audio pertama benar-benar
  // masuk (mis. video tanpa musik: suara baru ada setelah layar cover) sehingga
  // beberapa detik pertama hasil render bisa hilang.
  let silent: OscillatorNode | null = null;
  if (engine.recDest && engine.audioCtx) {
    try {
      silent = engine.audioCtx.createOscillator();
      const sg = engine.audioCtx.createGain();
      sg.gain.value = 0;
      silent.connect(sg);
      sg.connect(engine.recDest);
      silent.start();
    } catch {
      silent = null;
    }
  }
  if (engine.recDest) {
    for (const tr of engine.recDest.stream.getAudioTracks()) stream.addTrack(tr);
  }
  const rec = new MediaRecorder(stream, {
    mimeType: fmt.mime,
    videoBitsPerSecond: 9_000_000,
    audioBitsPerSecond: 192_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      try {
        silent?.stop();
        silent?.disconnect();
      } catch {
        /* ignore */
      }
      resolve(new Blob(chunks, { type: fmt.mime }));
    };
  });

  engine.pause();
  engine.seek(start);
  await sleep(450); // beri waktu seek
  // SIAPKAN frame video sejak SEKARANG (saat cover masih tampil): elemen video
  // sudah di-seek ke posisi sumber yang benar, jadi begitu cover selesai konten
  // langsung tampil tanpa layar hitam — detik cover TIDAK memakan detik video.
  await engine.prepareUpcoming(12);
  rec.start(400);
  await sleep(300); // pre-roll singkat: bingkai pertama & aliran audio terkunci dulu sebelum playback
  const dur = Math.max(0.1, end - start);
  engine.play({
    stopAt: end,
    onDone: () => {
      setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, 200);
    },
  });
  // pantau progres
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      const t = useEditor.getState().playhead;
      onProgress?.(Math.min(1, (t - start) / dur));
      if (!engine.playing) {
        clearInterval(iv);
        resolve();
      }
    }, 200);
  });
  const blob = await stopped;
  return blob;
}

function ensureTextTrack(tracks: Track[]): { tracks: Track[]; textTrack: Track } {
  let textTrack = tracks.find((t) => t.kind === "text");
  let out = tracks;
  if (!textTrack) {
    textTrack = { id: uid("tr"), kind: "text", name: "Teks Export", muted: false, hidden: false };
    out = [...tracks, textTrack];
  }
  return { tracks: out, textTrack };
}

function ensureVideoTrack(tracks: Track[]): { tracks: Track[]; videoTrack: Track } {
  let videoTrack = tracks.find((t) => t.kind === "video");
  let out = tracks;
  if (!videoTrack) {
    videoTrack = { id: uid("tr"), kind: "video", name: "Video Export", muted: false, hidden: false };
    out = [videoTrack, ...tracks];
  }
  return { tracks: out, videoTrack };
}

function baseClip(patch: Partial<Clip>): Clip {
  return {
    id: uid("cl"),
    trackId: "",
    kind: "video",
    start: 0,
    duration: 1,
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
    ...patch,
  };
}

export interface SplitProject {
  clips: Clip[];
  tracks: Track[];
  assets: MediaAsset[];
  duration: number;
}

export interface SplitProjectOptions {
  /** teks judul/deskripsi/part tampil selama SELURUH video berjalan (bukan hanya beberapa detik di awal) */
  persistText?: boolean;
  /** subtitle AI (waktu TIMELINE, sudah termasuk geser cover) — di-burn-in ke hasil */
  subs?: SubSegment[];
}

/** Bangun proyek sementara untuk satu bagian hasil split (dengan cover + teks part) */
export function buildSplitProject(
  st: ReturnType<typeof useEditor.getState>,
  partIndex: number,
  totalParts: number,
  rangeStart: number,
  rangeEnd: number,
  opts?: SplitProjectOptions
): SplitProject {
  const s = st.exportSettings;
  const shift = s.includeCover && st.cover.coverAssetId ? Math.max(2, Math.min(5, s.coverDuration)) : 0;
  const persist = !!opts?.persistText;
  // durasi isi video bagian ini (tanpa cover)
  const contentLen = Math.max(0.1, rangeEnd - rangeStart);
  // gaya tulisan otomatis dari menu Teks (ukuran huruf & font, bisa diatur pengguna)
  const titleSize = clampPct(st.texts.titleSize, 0.042);
  const descSize = clampPct(st.texts.descSize, 0.026);
  const partSize = clampPct(st.texts.partSize, 0.052);
  const fontAuto = st.texts.fontAuto || "condensed";
  let tracks = st.tracks.map((t) => ({ ...t }));
  let assets = [...st.assets];

  const clips: Clip[] = [];
  for (const clip of st.clips) {
    const cEnd = clip.start + clip.duration;
    // potong klip HANYA sepanjang rentang bagian ini (interseksi) —
    // sebelumnya klip tidak dipotong + inPoint diberi offset rentang sehingga
    // posisi sumber terhitung DOBEL: bagian ke-2 dst. melompati/mengulang isi
    // video (bagian tidak nyambung) dan bagian akhir layar hitam.
    const os = Math.max(clip.start, rangeStart);
    const oe = Math.min(cEnd, rangeEnd);
    if (oe - os < 0.05) continue;
    const nc = baseClip({
      ...clip,
      start: os - rangeStart + shift,
      duration: oe - os,
      transition: os <= clip.start + 0.05 ? clip.transition : undefined,
    });
    if ((clip.kind === "video" || clip.kind === "audio") && os > clip.start + 0.001) {
      // posisi sumber saat konten bagian ini dimulai; modulo menangani klip loop (>1)
      const srcSeg = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
      nc.inPoint = clip.inPoint + (((os - clip.start) * clip.speed) % Math.max(0.04, srcSeg));
    }
    clips.push(nc);
  }

  // gaya teks part mengikuti pilihan pengguna (Episode/Bagian/Eps/EP/Part);
  // v1.4.0 KolosalCut: template label kustom (mis. "BAGIAN KE-{n}") didukung
  const label = kcPartLabel(st.texts?.labelStyle || "Part", partIndex, totalParts, true);

  if (shift > 0 && st.cover.coverAssetId) {
    const vt = ensureVideoTrack(tracks);
    tracks = vt.tracks;
    clips.push(
      baseClip({
        trackId: vt.videoTrack.id,
        kind: "image",
        assetId: st.cover.coverAssetId,
        start: 0,
        duration: shift,
        effects: ["fx-kenburns"],
        label: "Cover",
        fadeOut: 0.3,
      })
    );
    const tt = ensureTextTrack(tracks);
    tracks = tt.tracks;
    clips.push(
      baseClip({
        trackId: tt.textTrack.id,
        kind: "text",
        start: 0.15,
        duration: Math.max(1.2, shift - 0.25),
        text: {
          content: st.texts.title || st.project.name,
          sub: `${st.texts.description ? st.texts.description + "  ·  " : ""}${label}`,
          size: clampPct(titleSize * 1.5, 0.063),
          subSize: clampPct(descSize * 1.15, 0.03),
          color: "#ffffff",
          font: fontAuto,
          subFont: fontAuto,
          anim: "slam",
          pos: "center",
          bg: "gradient",
          stroke: true,
          // posisi dari kolom geser di menu Teks
          offX: clampOffPct(st.texts.titleX),
          offY: clampOffPct(st.texts.titleY),
          subOffX: clampOffPct(st.texts.descX),
          subOffY: clampOffPct(st.texts.descY),
        },
      })
    );
  }

  const contentStart = shift;
  if (s.autoPartText) {
    const tt = ensureTextTrack(tracks);
    tracks = tt.tracks;
    clips.push(
      baseClip({
        trackId: tt.textTrack.id,
        kind: "text",
        start: contentStart + 0.4,
        // mode persisten: teks part tampil terus sampai video selesai
        duration: persist ? Math.max(0.8, contentLen - 0.4) : 2.4,
        text: {
          content: label,
          // ukuran part mengikuti kolom "Ukuran Part" di menu Teks (default 5.2% layar)
          size: partSize,
          color: "#ffffff",
          font: fontAuto,
          anim: "slam",
          pos: "bottom",
          bg: "bar",
          stroke: true,
          // v1.4.3: posisi vertikal part — 0 = paling atas (DEFAULT),
          // 100 = paling bawah, bisa digeser bebas dari menu Posisi Vertikal
          posV: clampV(st.texts.partV, 0),
          // posisi dari kolom geser Part di menu Teks (horizontal)
          offX: clampOffPct(st.texts.partX),
        },
      })
    );
  }
  if (s.showTitleText && st.texts.title) {
    const tt = ensureTextTrack(tracks);
    tracks = tt.tracks;
    clips.push(
      baseClip({
        trackId: tt.textTrack.id,
        kind: "text",
        start: contentStart + 0.3,
        // mode persisten: judul + deskripsi tampil terus sampai video selesai
        duration: persist ? Math.max(0.8, contentLen - 0.3) : 3.2,
        text: {
          content: st.texts.title,
          sub: st.texts.description || undefined,
          // ukuran judul & deskripsi mengikuti kolom di menu Teks (default 4.2% / 2.6%)
          size: titleSize,
          subSize: descSize,
          color: "#ffffff",
          font: fontAuto,
          subFont: fontAuto,
          anim: "rise",
          pos: "top",
          bg: "none",
          stroke: true,
          // v1.4.3: posisi vertikal judul+deskripsi — 100 = paling bawah
          // (DEFAULT), 0 = paling atas, bisa digeser bebas dari menu Teks
          posV: clampV(st.texts.titleV, 100),
          // v1.4.3: bingkai judul (10 gaya) — ukuran otomatis ikut tulisan
          // + skala manual dari menu BINGKAI JUDUL
          frame: st.texts.titleFrame || undefined,
          frameW: st.texts.titleFrameW,
          frameH: st.texts.titleFrameH,
          // posisi dari kolom geser Judul di menu Teks (horizontal)
          offX: clampOffPct(st.texts.titleX),
          subOffX: clampOffPct(st.texts.descX),
          subOffY: clampOffPct(st.texts.descY),
        },
      })
    );
  }

  // SUBTITLE AI otomatis — burn-in di bagian bawah layar (di atas teks part)
  if (opts?.subs?.length) {
    const tt = ensureTextTrack(tracks);
    tracks = tt.tracks;
    // KolosalCut: ukuran & posisi teks otomatis dari setelan pengguna
    const kcSub = st.kcSub;
    const subSize = clampPct(kcSub?.size ?? 0.028, 0.028);
    const subPosY = kcSub?.posY ?? 0.75;
    const subPos = kcAnchorFor(subPosY);
    const subOffY = kcOffYFor(subPosY, 0.02);
    for (const seg of opts.subs) {
      const s0 = Math.max(seg.start, rangeStart);
      const s1 = Math.min(seg.end, rangeEnd);
      if (s1 - s0 < 0.25) continue;
      clips.push(
        baseClip({
          trackId: tt.textTrack.id,
          kind: "text",
          start: s0 - rangeStart + shift,
          duration: s1 - s0,
          text: {
            content: seg.text,
            size: subSize,
            color: "#ffffff",
            font: fontAuto,
            anim: "fade",
            pos: subPos,
            bg: kcSub?.bg ?? "bar",
            stroke: true,
            offY: subOffY,
          },
        })
      );
    }
  }

  // KolosalCut v1.4.0: elemen DESKRIPSI sendiri — posisi/ukuran bebas pengguna
  if (st.kcDesc && st.kcDesc.text?.trim()) {
    const tt = ensureTextTrack(tracks);
    tracks = tt.tracks;
    const d = st.kcDesc;
    const dSize = clampPct(d.size / 1920, 0.026);
    clips.push(
      baseClip({
        trackId: tt.textTrack.id,
        kind: "text",
        start: contentStart + 0.3,
        duration: persist ? Math.max(0.8, contentLen - 0.3) : 3.2,
        text: {
          content: d.text,
          size: dSize,
          color: "#ffffff",
          font: d.font || fontAuto,
          anim: "rise",
          pos: kcAnchorFor(d.relY),
          bg: "none",
          stroke: true,
          offX: kcOffXFor(d.relX),
          offY: kcOffYFor(d.relY, dSize * 0.6),
        },
      })
    );
  }

  return { clips, tracks, assets, duration: shift + (rangeEnd - rangeStart) };
}

export function splitRanges(duration: number, mode: "count" | "duration", parts: number, partSeconds: number): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  if (duration <= 0.05) return ranges;
  if (mode === "count") {
    const n = Math.max(1, Math.min(50, Math.round(parts)));
    const len = duration / n;
    for (let i = 0; i < n; i++) ranges.push({ start: i * len, end: Math.min(duration, (i + 1) * len) });
  } else {
    const len = Math.max(1, partSeconds);
    for (let s = 0; s < duration; s += len) ranges.push({ start: s, end: Math.min(duration, s + len) });
  }
  return ranges;
}

/** Simpan/unduh satu hasil render.
 * Mode desktop + folder terpilih -> file langsung ditulis ke folder itu (tanpa dialog unduh).
 * Selain itu -> unduh otomatis ke folder unduhan bawaan.
 * v1.0.14: bila file SUDAH tersimpan langsung ke disk (tulis streaming directSave),
 * blob TIDAK diubah jadi objectURL — memori tetap rendah saat batch puluhan video
 * (dulu 50 hasil × ratusan MB tertahan di RAM → aplikasi hang). */
async function blobResult(blob: Blob | null, name: string, part: number, total: number, duration: number, savedPath?: string, size?: number, kcJobId?: string) {
  const dir = useEditor.getState().exportSettings.exportDir;
  if (!savedPath && blob && dir && isDesktopFS()) {
    try {
      useEditor.getState().patchExportState({ label: `Menyimpan ${name} ke folder...` });
      savedPath = await saveBlobToDir(dir, name, blob);
    } catch {
      savedPath = undefined; // gagal simpan -> fallback unduh
    }
  }
  const url = savedPath || !blob ? "" : URL.createObjectURL(blob);
  useEditor.getState().addExportResult({ id: uid("exp"), name, url, size: size ?? blob?.size ?? 0, part, total, duration, savedPath, ...(kcJobId ? { kcJobId } : {}) });
  if (!savedPath && url) triggerDownload(url, name);
}

/** true bila hasil render otomatis tersimpan ke folder pilihan pengguna */
export function isAutoSaveActive(): boolean {
  return !!useEditor.getState().exportSettings.exportDir && isDesktopFS();
}

export function triggerDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Export utama sesuai pengaturan (export saja / export & split).
 * Mode kilat: offscreen tanpa memutar video. Mode kompatibel: rekam real-time. */
export async function runExport() {
  const st0 = useEditor.getState();
  if (st0.exportState.running) return;
  const D = totalDuration(st0.clips);
  if (D < 0.3) {
    useEditor.getState().patchExportState({ label: "Timeline masih kosong" });
    return;
  }
  const s = st0.exportSettings;
  // gaya label (Part/Episode/Bagian/Eps/EP) pilihan pengguna ada di setelan TEKS
  const labelStyle = st0.texts?.labelStyle || "Part";
  useEditor.getState().patchExportState({ running: true, progress: 0, results: [], label: "Menyiapkan render..." });
  const snapshot = { clips: st0.clips, tracks: st0.tracks, assets: st0.assets };
  const baseName = slugify(st0.texts.title || st0.project.name);

  // mesin render: kilat (WebCodecs offscreen) bila tersedia
  const fast = s.engineMode === "fast" ? await fastSupported() : null;

  try {
    const firstVideo = st0.clips.map((c) => snapshot.assets.find((a) => a.id === c.assetId)).find((a) => a?.type === "video");
    // mode "tiap bagian beda": AI analisis sekali, tiap bagian hasil split pakai adegan berbeda
    let frameTimes: number[] | null = null;
    if (s.includeCover) {
      frameTimes = await pickFrameTimes(firstVideo);
      if (frameTimes) useEditor.getState().patchExportState({ label: "AI memilih adegan berbeda untuk tiap bagian..." });
    }
    const coverAssetReady = !!st0.cover.coverAssetId && st0.assets.some((a) => a.id === st0.cover.coverAssetId);
    if (s.includeCover && !coverAssetReady && !frameTimes) {
      useEditor.getState().patchExportState({ label: "AI membuat cover otomatis..." });
      await ensureCoverAsset(firstVideo);
    }

    // SUBTITLE AI: salin suara tiap klip video -> segmen waktu timeline
    const tlSubs: SubSegment[] = [];
    if (s.autoSub) {
      for (const c of st0.clips.filter((x) => x.kind === "video")) {
        const asset = st0.assets.find((a) => a.id === c.assetId);
        if (!asset || asset.musicId) continue;
        useEditor.getState().patchExportState({ label: "AI menyimak suara video (subtitle)..." });
        try {
          const segs = await transcribeAsset(asset, s.subLevel || "ringan", (p) => {
            useEditor.getState().patchExportState({ label: p.label || "Subtitle AI..." });
          });
          tlSubs.push(...mapSubsToTimeline(segs, st0.clips));
        } catch (e) {
          console.warn("Subtitle AI dilewati:", e);
          useEditor.getState().patchExportState({ label: "Subtitle AI dilewati (model gagal dimuat)" });
        }
      }
    }

    if (s.mode === "single") {
      useEditor.getState().patchExportState({ label: fast ? "Merender video penuh (mode kilat)..." : "Merender video penuh..." });
      // subtitle AI ditempel langsung ke proyek mentah (mode tanpa split)
      const withSubs = appendSubtitleClips(snapshot.clips, snapshot.tracks, tlSubs);
      if (fast) {
        const stNow = useEditor.getState();
        const rs = { clips: withSubs.clips, tracks: withSubs.tracks, assets: stNow.assets, project: { width: st0.project.width, height: st0.project.height } };
        const res = await exportRangeFast({ start: 0, end: D, rs, onProgress: (p) => useEditor.getState().patchExportState({ progress: p }) });
        await blobResult(res.blob, `${baseName}${res.ext}`, 1, 1, D);
      } else {
        useEditor.setState({ clips: withSubs.clips, tracks: withSubs.tracks });
        const fmt = pickExportFormat();
        const blob = await exportRange(0, D, (p) => useEditor.getState().patchExportState({ progress: p }));
        await blobResult(blob, `${baseName}${fmt.ext}`, 1, 1, D);
      }
    } else {
      const ranges = splitRanges(D, s.splitBy, s.parts, s.partSeconds);
      const total = ranges.length;
      for (let i = 0; i < total; i++) {
        const r = ranges[i];
        useEditor.getState().patchExportState({ label: `Merender ${partLabel(labelStyle, i + 1, total, true)}...`, batchIndex: i, batchTotal: total });
        const stNow = useEditor.getState();
        let assets = stNow.assets;
        let coverForPart = stNow.cover.coverAssetId;
        // latar "tiap bagian beda" -> cover baru dari adegan berbeda untuk bagian ini
        if (frameTimes && firstVideo) {
          if (fast) {
            const cov = await makeCoverAsset(firstVideo, frameTimes[i % frameTimes.length]);
            if (cov) {
              coverForPart = cov.id;
              assets = [...assets, cov];
            }
          } else {
            await ensureCoverAsset(firstVideo, true, frameTimes[i % frameTimes.length]);
            coverForPart = useEditor.getState().cover.coverAssetId;
            assets = useEditor.getState().assets;
          }
        }
        // proyek bagian ini selalu dibangun dari timeline ASLI (snapshot)
        const srcState = { ...stNow, clips: snapshot.clips, tracks: snapshot.tracks, assets, cover: { ...stNow.cover, coverAssetId: coverForPart } };
        const proj = buildSplitProject(srcState, i + 1, total, r.start, r.end, { subs: tlSubs });
        const label = partLabel(labelStyle, i + 1, total, true);
        if (fast) {
          const rs = { clips: proj.clips, tracks: proj.tracks, assets: proj.assets, project: { width: stNow.project.width, height: stNow.project.height } };
          const res = await exportRangeFast({ start: 0, end: proj.duration, rs, onProgress: (p) => useEditor.getState().patchExportState({ progress: (i + p) / total }) });
          await blobResult(res.blob, `${baseName}-${slugify(label)}${res.ext}`, i + 1, total, proj.duration);
        } else {
          useEditor.setState({ clips: proj.clips, tracks: proj.tracks, assets: proj.assets });
          engine.pause();
          engine.seek(0);
          await sleep(120);
          const fmt = pickExportFormat();
          const blob = await exportRange(0, proj.duration, (p) => {
            useEditor.getState().patchExportState({ progress: (i + p) / total });
          });
          await blobResult(blob, `${baseName}-${slugify(label)}${fmt.ext}`, i + 1, total, proj.duration);
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("Export gagal:", e);
    useEditor.getState().patchExportState({ label: `Gagal: ${msg}` });
  } finally {
    useEditor.setState({ clips: snapshot.clips, tracks: snapshot.tracks, assets: snapshot.assets });
    engine.pruneElements();
    engine.pause();
    engine.seek(0);
    const auto = isAutoSaveActive();
    const stEnd = useEditor.getState();
    if (!stEnd.exportState.label.startsWith("Gagal")) {
      stEnd.patchExportState({ running: false, label: auto ? "Selesai — semua file tersimpan di folder pilihanmu ✓" : "Selesai", progress: 1 });
    } else {
      stEnd.patchExportState({ running: false, progress: 1 });
    }
  }
}

/** Pastikan cover asset tersedia; buat otomatis bila perlu (force = buat ulang walau sudah ada).
 * frameTime opsional: pakai frame spesifik — untuk mode latar "tiap bagian beda".
 * Latar "hitam" tidak butuh frame video sama sekali. */
/** Buat asset cover TANPA menyentuh store global (aman dipanggil paralel).
 * Pemanggil memutuskan: dimasukkan ke store (jalur lama) atau dipakai lokal (mode kilat). */
async function makeCoverAsset(sourceAsset: MediaAsset | undefined, frameTime?: number): Promise<MediaAsset | undefined> {
  const st = useEditor.getState();
  if (st.cover.bgStyle !== "hitam" && (!sourceAsset || sourceAsset.type !== "video")) return undefined;
  const title = st.texts.title || sourceAsset?.name.replace(/\.[^.]+$/, "") || "Video";
  const { width, height } = st.project;

  // Latar hitam polos — pilihan pengguna, tanpa adegan video
  if (st.cover.bgStyle === "hitam") {
    const tpl = aiRecommendTemplates(title, 40, 1)[0] ?? COVER_TEMPLATES[0];
    const dataUrl = renderCoverToDataURL({ img: null, title: "", template: tpl, bgStyle: "hitam", frame: st.cover.frameStyle }, width, height);
    if (!dataUrl) return undefined;
    return { id: uid("as"), name: `Cover - ${title}`, type: "image", url: dataUrl, duration: 0, width, height };
  }

  let frameUrl: string | null = null;
  let brightness = 128;
  try {
    if (typeof frameTime === "number") {
      // adegan spesifik untuk bagian ini (mode "tiap bagian beda")
      frameUrl = await grabFrame(sourceAsset!.url, Math.max(0, Math.min(frameTime, sourceAsset!.duration - 0.2)), 1280);
    } else {
      const analysis = await analyzeVideoFrames(sourceAsset!.url, sourceAsset!.duration, 6);
      if (analysis.best) {
        brightness = analysis.best.brightness;
        frameUrl = await grabFrame(sourceAsset!.url, analysis.best.time, 1280);
      }
    }
  } catch {
    /* fallback di bawah */
  }
  if (!frameUrl) frameUrl = await grabFrame(sourceAsset!.url, Math.min(sourceAsset!.duration - 0.2, sourceAsset!.duration * 0.3), 1280);
  if (!frameUrl) return undefined;
  const tpl = aiRecommendTemplates(title, brightness, 1)[0] ?? COVER_TEMPLATES[0];
  const img = await loadImage(frameUrl).catch(() => null);
  if (!img) return undefined;
  // cover dibuat TANPA tulisan (latar saja) — judul/deskripsi/part ditulis oleh
  // clip teks di buildSplitProject agar judul panjang otomatis wrap & tak terpotong
  // v1.0.19: bingkai cover ikut ditanam sesuai pilihan pengguna
  const dataUrl = renderCoverToDataURL({ img, title: "", template: tpl, frame: st.cover.frameStyle }, width, height);
  return { id: uid("as"), name: `Cover - ${title}`, type: "image", url: dataUrl, duration: 0, width, height };
}

async function ensureCoverAsset(sourceAsset: MediaAsset | undefined, force = false, frameTime?: number): Promise<string | undefined> {
  const st = useEditor.getState();
  if (!force && st.cover.coverAssetId && st.assets.some((a) => a.id === st.cover.coverAssetId)) return st.cover.coverAssetId;
  const asset = await makeCoverAsset(sourceAsset, frameTime);
  if (!asset) return undefined;
  useEditor.getState().addAsset(asset);
  useEditor.getState().setCover({ coverAssetId: asset.id, previewUrl: asset.url, frameTime: 0 });
  return asset.id;
}

/** v1.0.19: buat ulang cover yang SUDAH ADA setelah gaya bingkai diubah, agar
 * bingkai baru langsung terlihat tanpa menunggu export. Return true bila cover diperbarui.
 * @param prevFrame gaya bingkai SEBELUM perubahan (untuk deteksi jalur overlay instan)
 *  - cover lama tanpa bingkai + bingkai baru → cukup tumpangkan bingkai di atas gambar lama (instan, latar persis sama)
 *  - selain itu → buat ulang dari sumber (gambar unggahan untuk mode manual, adegan video untuk mode auto)
 *  - belum ada cover sama sekali → false (nanti dibuat otomatis saat export, bingkai ikut) */
export async function regenCoverWithFrame(prevFrame: CoverFrameStyle = "none"): Promise<boolean> {
  const st = useEditor.getState();
  const { cover, project, texts, assets } = st;
  if (!cover.coverAssetId || !assets.some((a) => a.id === cover.coverAssetId)) return false;
  const frame = cover.frameStyle ?? "none";
  const { width, height } = project;
  const putAsset = (dataUrl: string, name: string) => {
    const asset: MediaAsset = { id: uid("as"), name, type: "image", url: dataUrl, duration: 0, width, height };
    useEditor.getState().addAsset(asset);
    useEditor.getState().setCover({ coverAssetId: asset.id, previewUrl: dataUrl });
  };
  try {
    if (cover.mode === "manual") {
      // mode gambar unggahan — bangun ulang dari gambar asli pengguna
      const m = assets.find((a) => a.id === cover.manualAssetId);
      if (!m) return false;
      const title = texts.title || m.name.replace(/\.[^.]+$/, "") || "Judul Video";
      const dataUrl = cover.manualPlain
        ? await plainCoverDataURL(m.url, width, height, frame)
        : renderCoverToDataURL({ img: await loadImage(m.url), title, template: COVER_TEMPLATES.find((t) => t.id === cover.templateId) ?? COVER_TEMPLATES[0], frame }, width, height);
      if (!dataUrl) return false;
      putAsset(dataUrl, `Cover - ${title}`);
      return true;
    }
    // mode otomatis (adegan video / hitam polos)
    if (cover.bgStyle === "hitam") {
      const src = assets.find((a) => a.type === "video" && (a.id === cover.frameAssetId || cover.frameAssetId === undefined));
      const asset = await makeCoverAsset(src);
      if (!asset) return false;
      putAsset(asset.url, asset.name);
      return true;
    }
    const old = assets.find((a) => a.id === cover.coverAssetId);
    if (old && prevFrame === "none" && frame !== "none") {
      // jalur instan: tumpangkan bingkai di atas cover lama yang masih "bersih"
      const img = await loadImage(old.url).catch(() => null);
      if (img) {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          drawCoverFrame(ctx, width, height, frame);
          const dataUrl = c.toDataURL("image/jpeg", 0.92);
          if (dataUrl) {
            putAsset(dataUrl, old.name);
            return true;
          }
        }
      }
    }
    // buat ulang dari adegan video (analisis ulang — hasil adegan sama karena deterministik)
    const vids = assets.filter((a) => a.type === "video");
    const src = vids.find((v) => v.id === cover.frameAssetId) ?? vids[0];
    if (!src) return false;
    const asset = await makeCoverAsset(src);
    if (!asset) return false;
    putAsset(asset.url, asset.name);
    return true;
  } catch {
    return false;
  }
}

/** AI pilih beberapa adegan berbeda (waktu frame, diurut dari skor terbaik)
 * untuk mode latar "tiap bagian beda". Null bila tidak relevan. */
async function pickFrameTimes(sourceAsset: MediaAsset | undefined): Promise<number[] | null> {
  const st = useEditor.getState();
  if (!sourceAsset || sourceAsset.type !== "video") return null;
  if (st.cover.mode !== "auto" || st.cover.bgStyle !== "adegan" || st.cover.bgScope !== "beda") return null;
  try {
    const analysis = await analyzeVideoFrames(sourceAsset.url, sourceAsset.duration, 8);
    const times = analysis.scores.map((sc) => sc.time);
    return times.length ? times : null;
  } catch {
    return null;
  }
}

/** v1.0.14: cache cover per batch — bagian split yang memakai adegan yang sama
 * tidak membuat ulang cover (dulu tiap bagian buat baru = ratusan gambar di RAM) */
const batchCoverCache = new Map<string, MediaAsset>();

function coverCacheKey(a: MediaAsset | undefined, ft?: number): string {
  const st = useEditor.getState();
  return `${a?.id ?? "-"}|${typeof ft === "number" ? ft.toFixed(2) : "auto"}|${st.project.width}x${st.project.height}|${st.cover.frameStyle ?? "none"}`;
}

async function makeCoverAssetCached(a: MediaAsset | undefined, ft?: number): Promise<MediaAsset | undefined> {
  const k = coverCacheKey(a, ft);
  const hit = batchCoverCache.get(k);
  if (hit) return hit;
  const cov = await makeCoverAsset(a, ft);
  if (cov) batchCoverCache.set(k, cov);
  return cov;
}

/** v1.0.14: pembatas laju pembaruan UI — progres maksimal ~3x/detik.
 * Dulu SETIAP frame memicu 2 pembaruan store × 3 video paralel = ~180 render
 * ulang React per detik → antarmuka macet (hang). */
function makeTick(ms = 300) {
  let last = 0;
  return (fn: () => void, force = false) => {
    const now = Date.now();
    if (force || now - last >= ms) {
      last = now;
      fn();
    }
  };
}

/** Export & split batch untuk semua video di playlist.
 * v1.0.14 — AMAN UNTUK BATCH BESAR (50+ film):
 *  - Fase persiapan INSTAN; kerja berat (adegan/cover/subtitle AI) LAZY per giliran render
 *  - Cover di-cache, audio MONO + cache per film, file hasil TULIS LANGSUNG ke disk
 *  - Elemen video dibersihkan tiap film selesai (dekoder tidak menumpuk → tak layar hitam)
 *  - Pembaruan UI dibatasi ~3x/dtk (badai render ulang penyebab hang dihapus)
 *  - Paralel otomatis diturunkan bila film terlalu panjang (mode hemat memori)
 * FASE 2 (mode kilat): beberapa video dirender BERSAMAAN (paralel 1-5);
 * mode kompatibel: berurutan seperti versi lama (rekam real-time). */
export async function runBatchExport(assetIds: string[]) {
  const st0 = useEditor.getState();
  if (st0.exportState.running || !assetIds.length) return;
  useEditor.getState().patchExportState({ running: true, progress: 0, results: [], label: "Menyiapkan batch...", batchTotal: assetIds.length, batchIndex: 0 });
  const snapshot = { clips: st0.clips, tracks: st0.tracks, assets: st0.assets, project: st0.project };
  const s = st0.exportSettings;
  // setelan teks khusus Playlist Export (judul otomatis, deskripsi, teks part)
  const pl = st0.playlistExport;

  // status per video (progres per baris di panel) — diinisialisasi dari daftar video
  const initJobs: BatchJobView[] = assetIds
    .map((id) => ({ id, asset: snapshot.assets.find((a) => a.id === id) }))
    .filter((x): x is { id: string; asset: MediaAsset } => !!x.asset && x.asset.type === "video")
    .map(({ id, asset }) => ({ id, name: asset.name, status: "antre" as const, progress: 0 }));
  useEditor.getState().setBatchJobs(initJobs);
  const markJob = (id: string, p: Partial<BatchJobView>) => useEditor.getState().patchBatchJob(id, p);

  // v1.0.15: hitung pekerjaan yang gagal supaya pesan akhir TIDAK bohong
  // "semua file tersimpan ✓" padahal ada yang gagal (bug tampilan v1.0.14)
  let failedCount = 0;
  /** v1.4.6: batch sudah benar-benar tamat — tick zombie tak boleh menimpa
   * progres 100% kembali ke 99% (ditulis di finally, dibaca report()) */
  let batchEnded = false;

  try {
    // rasio video hasil (pilihan di Menu Export Playlist): ganti ukuran proyek sementara
    // 16:9 = seperti aslinya; 9:16 = vertikal untuk Shorts/TikTok/Reels
    // v1.0.16: preset kualitas menentukan resolusi hasil (ringan=720p, tajam/maksimal=1080p)
    const targetDims = dimsFor(pl.ratio, pl.quality === "ringan" ? 720 : 1080);
    useEditor.getState().setProject({ ratio: pl.ratio, ...targetDims });
    engine.syncSize();
    const fast = s.engineMode === "fast" ? await fastSupported() : null;
    useEditor.getState().setExportSettings({ includeCover: pl.showTitleScreen, autoPartText: pl.showPartText, showTitleText: pl.titleDuringVideo });

    // cover bersama (mode manual) — dianalisis SEKALI untuk seluruh batch (50x lebih hemat)
    let sharedCoverId: string | undefined;
    let sharedCoverP: Promise<string | undefined> | null = null;
    const ensureSharedCover = (asset: MediaAsset) => {
      if (sharedCoverId) return Promise.resolve(sharedCoverId);
      sharedCoverP ??= (async () => {
        const st = useEditor.getState();
        if (st.cover.coverAssetId && st.assets.some((a) => a.id === st.cover.coverAssetId)) {
          sharedCoverId = st.cover.coverAssetId;
        } else {
          sharedCoverId = await ensureCoverAsset(asset);
        }
        return sharedCoverId;
      })();
      return sharedCoverP;
    };

    // antre subtitle AI GLOBAL — hanya SATU transkripsi berjalan bersamaan
    // (model AI & PCM 16k besar; dulu bisa 3 film sekaligus → memori meledak)
    let subChain: Promise<void> = Promise.resolve();

    // ========== FASE 1 — DAFTAR PEKERJAAN (INSTAN, tanpa kerja berat) ==========
    // v1.0.14: dulu SEMUA video dianalisis (adegan+cover+subtitle AI) di depan
    // → 50 film = aplikasi tampak beku berlama-lama di "Menyiapkan 23/50".
    // Sekarang hanya menyusun daftar; kerja berat pindah ke giliran render (LAZY).
    type BatchJob = {
      asset: MediaAsset;
      /** id asset ASLI (asset bisa dikloning utk batch paralel) */
      origId: string;
      title: string;
      coverAssetId?: string;
      frameTimes: number[] | null;
      prepped: boolean;
      /** id cover bagian yang sedang dirender (agar tak ikut dibersihkan) */
      curCoverId?: string;
      /** cache decode audio MILIK film ini — dipakai ulang semua bagian split */
      audio?: AudioDecodeCache;
      subs: SubSegment[]; // waktu SUMBER video
    };
    const jobs: BatchJob[] = [];
    for (let vi = 0; vi < assetIds.length; vi++) {
      const asset = snapshot.assets.find((a) => a.id === assetIds[vi]);
      if (!asset || asset.type !== "video") continue;
      const autoName = asset.name.replace(/\.[^.]+$/, "");
      const title = pl.autoTitle ? autoName : pl.titleCustom.trim() || autoName;
      // bila video yang SAMA muncul lagi dalam batch paralel, kloning identitas
      // assetnya (URL tetap sama) supaya tiap pekerjaan punya elemen decode sendiri
      let jobAsset = asset;
      if (jobs.some((j) => j.asset.id === asset.id)) jobAsset = { ...asset, id: `${asset.id}-p${vi}` };
      jobs.push({ asset: jobAsset, origId: asset.id, title, frameTimes: null, prepped: false, subs: [] });
      markJob(asset.id, { status: "antre", label: "Menunggu giliran render..." });
    }
    useEditor.getState().patchExportState({ label: `${jobs.length} video siap — mulai merender...` });

    /** kerja berat per video (adegan AI / cover / subtitle AI) — LAZY di awal
     * giliran render masing-masing video, dengan status jelas di barisnya */
    const prepJob = async (job: BatchJob, jid: string) => {
      if (job.prepped) return;
      if (pl.showTitleScreen) {
        if (useEditor.getState().cover.mode === "manual") {
          markJob(jid, { label: "Menyiapkan cover..." });
          job.coverAssetId = await ensureSharedCover(job.asset);
        } else if (useEditor.getState().cover.bgStyle === "adegan" && useEditor.getState().cover.bgScope === "beda") {
          markJob(jid, { label: "Menganalisis adegan (AI)..." });
          job.frameTimes = await pickFrameTimes(job.asset);
        }
        if (!job.frameTimes && !job.coverAssetId) {
          markJob(jid, { label: "Menyiapkan cover..." });
          job.coverAssetId = await ensureCoverAsset(job.asset, true);
        }
      }
      if (pl.autoSub && !job.subs.length) {
        await (subChain = subChain.then(async () => {
          if (job.subs.length) return;
          try {
            job.subs = await transcribeAsset(job.asset, pl.subLevel || "ringan", (p) => {
              markJob(jid, { label: p.label || "Subtitle AI..." });
            });
          } catch (e) {
            console.warn("Subtitle AI dilewati:", e);
          }
        }));
      }
      job.prepped = true;
    };

    // ========== FASE 2 — RENDER ==========
    const jobProgress = new Array(jobs.length).fill(0) as number[];
    // v1.4.5: badge mesin per film — TAMPIL TERUS di baris status sehingga
    // pengguna selalu tahu mesin apa yang bekerja & seberapa cepat:
    // "TURBO 8.4x" (GPU) / "TURBO CPU 0.7x" (lambat) / "KILAT (alasan)"
    const jobBadge = new Map<string, string>();
    /** v1.0.17: film yang SEDANG berjalan (prep/segmen) — elemen medianya tidak
     * ikut dibersihkan. Elemen video kini hanya dibuat jalur kompatibel & fallback;
     * mesin Turbo bekerja tanpa elemen <video> sama sekali. */
    const filmActive = new Set<number>();
    let doneCount = 0;
    /** v1.0.16: bobot per pekerjaan = jumlah bagian split — film 2 jam beratnya
     * lebih besar daripada video pendek 1 bagian, supaya ETA akurat */
    const jobParts = new Array(jobs.length).fill(1) as number[];
    const t0 = performance.now();
    /** v1.4.4: timer ETA kini MULAI saat bagian PERTAMA mulai dirender — dulu
     * dihitung dari awal batch, jadi persiapan berat (cover + baca suara AI
     * puluhan menit pada film panjang) ikut terhitung dan estimasi "±9 jam"
     * muncul padahal rendernya sendiri cepat. Angka kini murni kecepatan render. */
    let renderT0 = 0;
    const report = () => {
      if (batchEnded) return; // v1.4.6: batch tamat — jangan timpa progres 100%
      let sum = 0;
      let wsum = 0;
      for (let i = 0; i < jobs.length; i++) {
        const w = Math.max(1, jobParts[i] || 1);
        sum += (jobProgress[i] || 0) * w;
        wsum += w;
      }
      const prog = Math.min(0.99, sum / Math.max(1, wsum));
      // v1.0.16: estimasi waktu tersisa — makin akurat setelah ±5% pekerjaan tuntas
      const elapsed = (performance.now() - (renderT0 || t0)) / 1000;
      const eta = prog > 0.02 && elapsed > 8 ? Math.max(0, (elapsed / prog) * (1 - prog)) : undefined;
      useEditor.getState().patchExportState({ progress: prog, ...(eta !== undefined ? { eta } : {}) });
    };

    /** v1.4.6: peta "detak jantung" per bagian yang sedang dirender —
     * key "vi:i" -> timestamp tick terakhir. Dipakai penjaga antrean untuk
     * mendeteksi bagian yang MACET (tanpa progres berminit-menit) supaya
     * batch tetap bisa tamat alih-alih mentok 99% selamanya. */
    const segTickAt = new Map<string, number>();

    /** v1.0.14: bersihkan elemen video/gambar film yang SUDAH selesai.
     * Dulu elemen hanya dibersihkan SETELAH SEMUA film selesai — 50 film = 50
     * dekoder video terbuka bersamaan → layar hitam & memori habis. */
    const pruneFinished = () => {
      const keep = new Set<string>();
      for (const vi of filmActive) {
        const j = jobs[vi];
        if (!j) continue;
        keep.add(`video:${j.asset.id}`);
        if (j.curCoverId) keep.add(`image:${j.curCoverId}`);
      }
      engine.pruneElements(keep);
    };

    /** klip video batch + track utk satu pekerjaan (memakai setelan Efek & Klip "Video Playlist") */
    const buildBatchClip = (job: BatchJob) => {
      const vt = ensureVideoTrack([{ id: "batch-video", kind: "video", name: "V", muted: false, hidden: false }]);
      const fillZoom = pl.ratio === "9:16" && pl.fitMode === "fill" ? fillZoomFor(job.asset.width, job.asset.height, targetDims.width, targetDims.height) ?? 1 : 1;
      const en = normalizeEnhance(pl.enhance);
      const enOn = !!en.enabled;
      const speed = enOn ? en.speed : 1;
      const loop = enOn ? en.loopCount : 1;
      const clip = baseClip({
        trackId: "batch-video",
        kind: "video",
        assetId: job.asset.id,
        start: 0,
        duration: (job.asset.duration / speed) * loop,
        speed,
        loopCount: loop,
        volume: enOn ? en.volume : 1,
        fadeIn: enOn ? en.fadeIn : 0,
        fadeOut: enOn ? en.fadeOut : 0,
        effects: enOn ? [...en.effects] : [],
        // v1.0.20: ZOOM & GESER berdiri SENDIRI — selalu diterapkan walau toggle
        // "efek & klip" mati (menu ZOOM & POSISI VIDEO UTUH di Rasio & Layar
        // menulis ke sini). Bawaan 1x/0/0 = perilaku lama, tanpa perubahan.
        zoom: Math.min(8, en.zoom * fillZoom),
        panX: en.panX,
        panY: en.panY,
      });
      if (enOn && en.transitionType) clip.transition = { type: en.transitionType, duration: en.transitionDuration };
      const textTrack: Track = { id: "batch-text", kind: "text", name: "T", muted: false, hidden: false };
      return { clip, tracks: [...vt.tracks, textTrack] };
    };

    const rangesFor = (clip: Clip) => {
      const D = clip.duration;
      return s.mode === "single" ? [{ start: 0, end: D }] : splitRanges(D, s.splitBy, s.parts, s.partSeconds);
    };

    // =====================================================================
    // v1.0.17 — ANTREAN GLOBAL PER BAGIAN (#7) + MESIN TURBO (#8)
    // Dulu: 1 film = 1 pekerjaan; bagian-bagiannya dirender BERGILIRAN sehingga
    // pekerja menganggur menunggu satu bagian panjang.
    // Kini: SEMUA bagian dari SEMUA film masuk SATU antrean kerja global;
    // pekerja menarik tugas selama anggaran RAM masih cukup — bagian film mana
    // pun bisa berjalan bersamaan. Setiap bagian dirender dengan MESIN TURBO
    // (WebCodecs murni + audio stream-copy) bila filmnya didukung; bila tidak,
    // bagian itu otomatis memakai mesin kilat lama. Satu bagian Turbo yang
    // gagal juga jatuh ke mesin lama — hasil tetap benar, batch tidak berhenti.
    // =====================================================================
    type PrepResult = {
      clip: Clip;
      tracks: Track[];
      ranges: { start: number; end: number }[];
      audio: AudioDecodeCache;
      tlSubs: SubSegment[];
      turbo: boolean;
      audioCopy: boolean;
    };
    const prepped = new Map<number, PrepResult>();
    /** bagian yang sudah tuntas per film (termasuk yang dilewati resume) */
    const segDone = new Map<number, Set<number>>();
    const failedSegs = new Map<number, number>();
    const segQueue: { vi: number; i: number }[] = [];
    let failedSegments = 0;
    /** terpakai RAM (MB): cache audio PCM film aktif + segmen berjalan */
    let ramUsed = 0;

    /** berat RAM cache audio PCM satu film (0 bila audio stream-copy).
     * v1.4.4: DIBATASI 350 MB — dulu estimasi duration*0,19 MB/dtk untuk film
     * 90 menit = ±1 GB, memakan hampir seluruh anggaran RAM 1,5 GB sehingga
     * antrean hanya sanggup menjalankan 1-2 bagian serentak (export terasa
     * berhenti). Batas menjaga jalur cadangan (video non-MP4) tetap paralel. */
    const filmRamMB = (vi: number): number => {
      const pr = prepped.get(vi);
      if (!pr || (pr.turbo && pr.audioCopy)) return 0;
      return Math.min(350, (jobs[vi]?.asset.duration || 0) * 0.19);
    };
    /** berat RAM satu segmen yang sedang dirender */
    const segRamMB = (vi: number, partLen: number): number => {
      const pr = prepped.get(vi);
      const streaming = !!s.exportDir && isDesktopFS();
      if (pr?.turbo) return 240 + partLen * 0.02; // decoder+encoder+kanvas
      return 150 + partLen * 0.19 + (streaming ? 0 : partLen * 1.125);
    };

    /** film tamat bila semua bagiannya sudah tuntas (render/skip/gagal) */
    const finishedFilms = new Set<number>(); // v1.4.6: cegah tamat dua kali (zombie vs penjaga)
    const finishFilmIfDone = (vi: number, total: number) => {
      const done = segDone.get(vi);
      if (!done || done.size < total) return;
      if (finishedFilms.has(vi)) return;
      finishedFilms.add(vi);
      filmActive.delete(vi);
      ramUsed -= filmRamMB(vi);
      if (ramUsed < 0) ramUsed = 0;
      jobProgress[vi] = 1;
      doneCount++;
      report();
      const fails = failedSegs.get(vi) || 0;
      const job = jobs[vi];
      if (fails > 0) {
        failedSegments += fails;
        markJob(job.origId, { status: "gagal", label: `${fails} bagian gagal ✗` });
      } else {
        markJob(job.origId, { status: "selesai", progress: 1, label: "Selesai ✓" });
        if (pl.soundDone) chime("film");
      }
      // bebaskan cache audio & catatan Turbo film ini SEKARANG
      job.audio?.dispose();
      job.audio = undefined;
      releaseTurboParse(job.asset.url);
      pruneFinished();
    };

    const markSegDone = (vi: number, i: number, total: number) => {
      const done = segDone.get(vi) ?? new Set<number>();
      done.add(i);
      segDone.set(vi, done);
      jobProgress[vi] = done.size / total;
      finishFilmIfDone(vi, total);
    };

    /** Siapkan satu film (LAZY di gilirannya): cek resume → cover/subtitle AI →
     * smart split → putuskan mesin → antrekan semua bagiannya ke antrean global */
    const prepFilm = async (job: BatchJob, vi: number): Promise<void> => {
      const jid = job.origId;
      markJob(jid, { status: "jalan", progress: 0, label: "Menyiapkan..." });
      const direct = s.exportDir && isDesktopFS() ? { dir: s.exportDir } : null;
      const { clip, tracks } = buildBatchClip(job);
      let ranges = rangesFor(clip);
      jobParts[vi] = ranges.length;
      const done = new Set<number>();
      segDone.set(vi, done);
      // ===== v1.0.16: RESUME BATCH — bagian yang filenya sudah ada dilewati
      // SEBELUM analisis berat (cover/subtitle AI) =====
      if (direct && pl.skipExisting !== false && fast) {
        const ext = fast.ext;
        markJob(jid, { label: "Memeriksa file yang sudah ada..." });
        const have: { i: number; size: number; path?: string }[] = [];
        for (let i = 0; i < ranges.length; i++) {
          const nm = `${slugify(job.title)}-${slugify(kcPartLabel(pl.labelStyle, i + 1, ranges.length, true))}${ext}`;
          const sz = await fileSizeInDir(direct.dir, nm);
          if (sz >= 1024) have.push({ i, size: sz, path: `${direct.dir}/${nm}` });
        }
        const addResult = (h: { i: number; size: number; path?: string }) => {
          useEditor.getState().addExportResult({
            id: uid("exp"),
            name: `${slugify(job.title)}-${slugify(kcPartLabel(pl.labelStyle, h.i + 1, ranges.length, true))}${ext}`,
            url: "",
            size: h.size,
            part: h.i + 1,
            total: ranges.length,
            duration: Math.max(0.1, ranges[h.i].end - ranges[h.i].start),
            savedPath: h.path,
            kcJobId: jid,
          });
        };
        if (have.length === ranges.length) {
          for (const h of have) addResult(h);
          for (let i = 0; i < ranges.length; i++) done.add(i);
          finishFilmIfDone(vi, ranges.length);
          markJob(jid, { label: "Sudah ada — dilewati ✓" });
          return;
        }
        if (have.length) {
          for (const h of have) {
            addResult(h);
            done.add(h.i);
          }
          markJob(jid, { label: `${have.length}/${ranges.length} bagian sudah ada — lanjut sisanya` });
        }
      }
      await prepJob(job, jid);
      // v1.0.14: cache audio MILIK film ini — SEMUA bagian split memakai ulang
      const audio = new AudioDecodeCache(new OfflineAudioContext(1, 1, 48000));
      job.audio = audio;
      // ===== v1.0.16: SMART SPLIT — geser tiap batas ke jeda sunyi audio =====
      if (pl.smartSplit && ranges.length > 1) {
        markJob(jid, { label: "Mencari jeda sunyi (audio)..." });
        try {
          const asrc = await audio.get(job.asset.id, job.asset.url);
          const sr = asrc.sampleRate || 48000;
          if (asrc.mono && asrc.mono.length > sr) {
            ranges = adjustRangesToSilence(ranges, asrc.mono, sr, clip.speed, asrc.mono.length / sr);
          }
        } catch {
          /* analisis gagal — pakai pembagian rata biasa */
        }
      }
      const tlSubs = mapSubsToTimeline(job.subs, [clip]);
      // ===== keputusan mesin: sekali per film, bukan per bagian =====
      // v1.4.4: saklar kcDisableTurbo DIHAPUS — mesin Turbo SELALU dipakai
      // bila video didukung, termasuk saat setelan EKSPORT "Render Penuh"
      // (hasil identik — satu jalur composeFrame sejak v1.4.3). Dulu setelan
      // "Render Penuh" tanpa sadar mematikan Turbo → mesin lama 2-20x lebih
      // lambat + antrean RAM tersendat (cache PCM film panjang) = export
      // 4-9 jam pada film 90 menit. Kini semua jalur memakai Turbo.
      const chk = await turboEligible(job.asset);
      const turbo = !!chk.ok && clip.loopCount === 1;
      const audioCopy = turbo
        ? audioCopyAllowed({ clips: [clip], tracks, assets: [job.asset], project: { width: targetDims.width, height: targetDims.height } }, clip, job.asset)
        : false;
      prepped.set(vi, { clip, tracks, ranges, audio, tlSubs, turbo, audioCopy });
      if (turbo) {
        useEditor.getState().patchExportState({
          label: `${job.title} — mesin TURBO aktif (WebCodecs murni${audioCopy ? ", audio asli disalin" : ""})`,
        });
      } else if (chk.reason) {
        markJob(jid, { label: `Mode kilat (Turbo mati: ${chk.reason})` });
        // v1.4.5: alasan ditempel permanen di badge baris — dulu label ini
        // langsung tertimpa label bagian sehingga pengguna tak pernah tahu
        jobBadge.set(jid, `KILAT (${chk.reason})`);
      }
      // antrekan bagian yang belum ada filenya — SATU ANTREAN UNTUK SEMUA FILM
      for (let i = 0; i < ranges.length; i++) {
        if (!done.has(i)) segQueue.push({ vi, i });
      }
    };

    /** Render SATU bagian — unit kerja antrean global. Mesin Turbo dulu;
     * bila gagal, bagian ini otomatis diulang dengan mesin kilat lama. */
    const renderSegment = async (vi: number, i: number) => {
      const pr = prepped.get(vi)!;
      const job = jobs[vi];
      const jid = job.origId;
      const r = pr.ranges[i];
      const total = pr.ranges.length;
      const partTxt = kcPartLabel(pl.labelStyle, i + 1, total, true);
      const tick = makeTick();
      // v1.4.5: badge mesin ditempel di SEMUA label bagian agar tak tertimpa
      const badge = () => {
        const b = jobBadge.get(jid);
        return b ? ` · ${b}` : "";
      };
      if (!renderT0) renderT0 = performance.now(); // v1.4.4: ETA mulai dari render pertama
      // v1.4.0: video dibatalkan pengguna — lewati tanpa merender
      if (kcCancelled(jid)) {
        markSegDone(vi, i, total);
        return;
      }
      try {
        useEditor.getState().patchExportState({
          label: `${job.title} — ${partTxt} (${doneCount + 1}/${jobs.length} berjalan)`,
          batchIndex: vi,
          batchTotal: jobs.length,
        });
        markJob(jid, { label: `${total > 1 ? partTxt : "Merender..."}${badge()}` });
        // cover bagian ini — asset LOKAL + CACHE (tanpa race store antar pekerja)
        let coverAssetId = job.coverAssetId;
        let assets = useEditor.getState().assets;
        if (job.frameTimes) {
          const cov = await makeCoverAssetCached(job.asset, job.frameTimes[i % job.frameTimes.length]);
          if (cov) {
            coverAssetId = cov.id;
            job.curCoverId = cov.id;
            assets = [...assets, cov];
          }
        }
        const cur = useEditor.getState();
        const srcState = {
          ...cur,
          clips: [pr.clip] as Clip[],
          tracks: pr.tracks,
          assets,
          cover: { ...cur.cover, coverAssetId },
          texts: { ...cur.texts, title: job.title, description: pl.description, labelStyle: pl.labelStyle },
        };
        const proj = buildSplitProject(srcState, i + 1, total, r.start, r.end, {
          persistText: pl.titleDuringVideo,
          subs: pr.tlSubs,
        });
        const rs = { clips: proj.clips, tracks: proj.tracks, assets: proj.assets, project: { width: targetDims.width, height: targetDims.height } };
        const direct = s.exportDir && isDesktopFS() ? { dir: s.exportDir } : null;
        const directSave = direct ? { dir: direct.dir, name: `${slugify(job.title)}-${slugify(partTxt)}` } : undefined;
        const bitrate = pl.quality === "ringan" ? 4_500_000 : pl.quality === "maksimal" ? 14_000_000 : 9_000_000;
        // geser cover — rumus SAMA dengan buildSplitProject
        const shift = s.includeCover && coverAssetId ? Math.max(2, Math.min(5, s.coverDuration)) : 0;
        const onProgress = (p: number) => {
          const frac = ((segDone.get(vi)?.size ?? 0) + p) / total;
          jobProgress[vi] = frac;
          segTickAt.set(`${vi}:${i}`, Date.now()); // v1.4.6: detak jantung bagian
          tick(
            () => {
              report();
              markJob(jid, { progress: frac });
            },
            p >= 1,
          );
        };
        let res: { blob: Blob; ext: ".mp4" | ".webm"; savedPath?: string; size?: number; mime: string };
        if (pr.turbo) {
          try {
            const t = await exportSegmentTurbo({
              rs,
              clip: proj.clips.find((c) => c.kind === "video")!,
              asset: job.asset,
              start: r.start,
              end: r.end,
              shift,
              bitrate,
              ...(directSave ? { directSave } : {}),
              audioCache: pr.audio,
              audioCopy: pr.audioCopy,
              onProgress,
              // v1.4.5: kecepatan terukur tampil permanen di baris status —
              // pengguna langsung tahu rendernya di-GPU atau di-CPU
              onSpeed: (mult) => {
                const b = mult >= 1.2 ? `TURBO ${mult.toFixed(1)}x` : `TURBO CPU ${mult.toFixed(1)}x`;
                if (jobBadge.get(jid) !== b) {
                  jobBadge.set(jid, b);
                  markJob(jid, { label: `${partTxt} · ${b}` });
                }
              },
            });
            res = t;
          } catch (e) {
            // Turbo gagal untuk bagian ini — mesin kilat lama mengerjakan bagian ini
            console.warn(`Turbo gagal (${partTxt}) — pakai mesin kilat lama:`, e);
            // v1.4.5: sebab tampil permanen di badge (termasuk "Turbo lambat" —
            // berarti tak ada konfigurasi encoder yang lebih cepat di PC ini)
            const why = (e instanceof Error ? e.message : "error").split("\n")[0].slice(0, 44);
            jobBadge.set(jid, `KILAT (${why})`);
            res = await exportRangeFast({ start: 0, end: proj.duration, rs, audioCache: pr.audio, bitrate, ...(directSave ? { directSave } : {}), onProgress });
          }
        } else {
          res = await exportRangeFast({ start: 0, end: proj.duration, rs, audioCache: pr.audio, bitrate, ...(directSave ? { directSave } : {}), onProgress });
        }
        await blobResult(res.blob, `${slugify(job.title)}-${slugify(partTxt)}${res.ext}`, i + 1, total, proj.duration, res.savedPath, res.size, jid);
        markSegDone(vi, i, total);
      } catch (e) {
        console.error(`Export gagal: ${job.title} ${partTxt}`, e);
        failedSegs.set(vi, (failedSegs.get(vi) || 0) + 1);
        const m = e instanceof Error ? e.message : "error";
        markJob(jid, { label: `${partTxt} gagal ✗ (${m})` });
        markSegDone(vi, i, total); // tetap dihitung tuntas agar film bisa tamat
      }
    };

    /** Penjadwal antrean global: prep film (maks 2 bersamaan, kerja AI/IO) +
     * segmen (maks 5 bersamaan & sesuai anggaran RAM ~1,5 GB). */
    const runTurboQueue = async (): Promise<number> => {
      const RAM_BUDGET_MB = 1500;
      // v1.4.0 KolosalCut: jumlah pekerja mengikuti setelan PARALEL pengguna (1-7, dibatasi 5)
      // v1.4.2: batas pekerja naik 5 -> 7 (antrean berbasis anggaran RAM tetap menjaga memori)
      // v1.4.4: fallback nilai rusak/NaN kini 5 (mengikuti default baru & NOVACUT),
      // dulu || 2 yang membuat batch lambat tanpa kelihatan penyebabnya
      const MAX_CONC = Math.max(1, Math.min(7, Math.round(Number(useEditor.getState().playlistExport.parallel) || 5)));
      const PREP_CONC = Math.min(2, Math.max(1, jobs.length));
      let prepNext = 0;
      let prepRunning = 0;
      let segRunning = 0;
      await new Promise<void>((resolve) => {
        let settled = false;
        /** v1.4.6 — PENJAGA ANTREAN (jaring pengaman terakhir anti mentok 99%):
         * tiap 30 detik periksa bagian yang sedang berjalan. Bagian TANPA detak
         * progres > 8 menit dianggap MACET (encoder mati diam-diam / driver GPU /
         * memori): ditandai gagal, dilepas dari antrean, batch LANJUT berjalan.
         * Dulu SATU bagian yang menggantung membekukan seluruh batch di 99%
         * selamanya — "Batch selesai" tak pernah muncul. Kini mustahil beku. */
        const REAP_MS = 8 * 60_000;
        const watchdog = setInterval(() => {
          try {
            const now = Date.now();
            for (const [key, ts] of [...segTickAt]) {
              if (now - ts < REAP_MS) continue;
              const [viS, iS] = key.split(":").map(Number);
              if (segDone.get(viS)?.has(iS)) {
                segTickAt.delete(key); // sudah terhitung tuntas — tinggal zombie akuntansi
                continue;
              }
              segTickAt.delete(key);
              const total2 = prepped.get(viS)?.ranges.length || Math.max(1, jobParts[viS] || 1);
              failedSegs.set(viS, (failedSegs.get(viS) || 0) + 1);
              try {
                markJob(jobs[viS]?.origId ?? "", { label: `Bagian ${iS + 1} macet — dihentikan ✗` });
              } catch {
                /* UI */
              }
              segRunning = Math.max(0, segRunning - 1);
              markSegDone(viS, iS, total2);
            }
            pump(); // sekalian: bila ada bug check-tamat, ini menyelesaikannya
          } catch {
            /* penjaga tak boleh meledak */
          }
        }, 30_000);
        /** film yang sudah ditandai batal — tidak diproses dua kali */
        const cancelHandled = new Set<number>();
        /** tandai film batal: seluruh bagiannya dianggap tuntas */
        const cancelFilm = (vi: number) => {
          const total = Math.max(1, jobParts[vi] || 1);
          const done = segDone.get(vi) ?? new Set<number>();
          for (let i = 0; i < total; i++) done.add(i);
          segDone.set(vi, done);
          markJob(jobs[vi].origId, { status: "gagal", label: "Dibatalkan" });
          finishFilmIfDone(vi, total);
        };
        const pump = () => {
          if (settled) return;
          // v1.4.0: sapu pembatalan — film yang dibatalkan dilewati seluruhnya
          for (let vi = 0; vi < jobs.length; vi++) {
            if (cancelHandled.has(vi)) continue;
            const d = segDone.get(vi);
            if (d && d.size >= Math.max(1, jobParts[vi] || 1)) continue; // sudah tamat
            if (kcCancelled(jobs[vi].origId)) {
              cancelHandled.add(vi);
              cancelFilm(vi);
            }
          }
          // buang bagian milik film yang dibatalkan dari antrean
          while (segQueue.length && kcCancelled(jobs[segQueue[0].vi]?.origId ?? "")) segQueue.shift();
          // mulai prep film berikutnya
          while (prepRunning < PREP_CONC && prepNext < jobs.length) {
            const vi = prepNext++;
            prepRunning++;
            filmActive.add(vi);
            void prepFilm(jobs[vi], vi)
              .catch((e) => {
                console.error("Persiapan film gagal:", jobs[vi].title, e);
                failedSegs.set(vi, (failedSegs.get(vi) || 0) + 1);
                const total = Math.max(1, jobParts[vi] || 1);
                const done = segDone.get(vi) ?? new Set<number>();
                for (let i = 0; i < total; i++) done.add(i);
                segDone.set(vi, done);
                markJob(jobs[vi].origId, { label: `Gagal: ${e instanceof Error ? e.message : "error"}` });
                finishFilmIfDone(vi, total);
              })
              .finally(() => {
                prepRunning--;
                ramUsed += filmRamMB(vi);
                pump();
              });
          }
          // tarik segmen dari antrean selama anggaran masih cukup
          while (segQueue.length && segRunning < MAX_CONC) {
            const t = segQueue[0];
            const pr = prepped.get(t.vi);
            if (!pr) break; // film belum selesai disiapkan — tunggu
            const w = segRamMB(t.vi, Math.max(0.1, pr.ranges[t.i].end - pr.ranges[t.i].start));
            if (segRunning > 0 && ramUsed + w > RAM_BUDGET_MB) break;
            segQueue.shift();
            ramUsed += w;
            segRunning++;
            segTickAt.set(`${t.vi}:${t.i}`, Date.now()); // v1.4.6: mulai detak
            void renderSegment(t.vi, t.i).finally(() => {
              segRunning = Math.max(0, segRunning - 1); // v1.4.6: klem (zombie bisa mengurangi dua kali)
              ramUsed -= w;
              if (ramUsed < 0) ramUsed = 0;
              segTickAt.delete(`${t.vi}:${t.i}`);
              pump();
            });
          }
          if (prepRunning === 0 && segRunning === 0 && prepNext >= jobs.length && segQueue.length === 0) {
            clearInterval(watchdog); // v1.4.6: batch tamat — penjaga berhenti
            settled = true;
            resolve();
          }
        };
        pump();
      });
      return failedSegments;
    };

    /** MODE KOMPATIBEL: jalur lama berurutan (rekam real-time via MediaRecorder) */
    const renderJobLegacy = async (job: BatchJob, vi: number) => {
      const jid = job.origId;
      try {
        markJob(jid, { status: "jalan", progress: 0, label: "Menyiapkan..." });
        await prepJob(job, jid);
        const { clip, tracks } = buildBatchClip(job);
        const ranges = rangesFor(clip);
        const tlSubs = mapSubsToTimeline(job.subs, [clip]);
        const fmt = pickExportFormat();
        const tick = makeTick();
        for (let i = 0; i < ranges.length; i++) {
          const r = ranges[i];
          const partTxt = kcPartLabel(pl.labelStyle, i + 1, ranges.length, true);
          useEditor.getState().patchExportState({
            label: `${job.title} — ${partTxt} (${vi + 1}/${jobs.length})`,
            batchIndex: vi,
            batchTotal: jobs.length,
          });
          markJob(jid, { label: ranges.length > 1 ? partTxt : "Merender..." });
          let coverAssetId = job.coverAssetId;
          if (job.frameTimes) {
            await ensureCoverAsset(job.asset, true, job.frameTimes[i % job.frameTimes.length]);
            coverAssetId = useEditor.getState().cover.coverAssetId;
          }
          const tempState = {
            ...useEditor.getState(),
            clips: coverAssetId ? [clip, baseClip({ trackId: "batch-video", kind: "image", assetId: coverAssetId, start: 0, duration: 0, label: "cover-holder" })] : ([clip] as Clip[]),
            tracks,
            assets: useEditor.getState().assets,
            cover: { ...useEditor.getState().cover, coverAssetId },
            texts: { ...useEditor.getState().texts, title: job.title, description: pl.description, labelStyle: pl.labelStyle },
          };
          const proj = buildSplitProject(tempState, i + 1, ranges.length, r.start, r.end, {
            persistText: pl.titleDuringVideo,
            subs: tlSubs,
          });
          useEditor.setState({ clips: proj.clips, tracks: proj.tracks, assets: proj.assets });
          engine.pause();
          engine.seek(0);
          await sleep(120);
          const blob = await exportRange(0, proj.duration, (p) => {
            const frac = (i + p) / ranges.length;
            jobProgress[vi] = frac;
            tick(
              () => {
                report();
                markJob(jid, { progress: frac });
              },
              frac >= 1,
            );
          });
          const label = kcPartLabel(pl.labelStyle, i + 1, ranges.length, true);
          await blobResult(blob, `${slugify(job.title)}-${slugify(label)}${fmt.ext}`, i + 1, ranges.length, proj.duration, undefined, undefined, job.origId);
        }
        jobProgress[vi] = 1;
        doneCount++;
        markJob(jid, { status: "selesai", progress: 1, label: "Selesai ✓" });
        if (pl.soundDone) chime("film");
      } catch (e) {
        const m = e instanceof Error ? e.message : "error";
        console.error(`Export gagal: ${job.title}`, e);
        markJob(jid, { status: "gagal", label: `Gagal: ${m}` });
        throw e;
      } finally {
        // bersihkan elemen antar video pada mode berurutan
        engine.pruneElements();
      }
    };

    if (fast) {
      // v1.0.17: ANTREAN GLOBAL PER BAGIAN — semua bagian dari seluruh batch
      // dikerjakan bersamaan sesuai anggaran RAM (maks 5 bagian berjalan).
      failedCount = await runTurboQueue();
    } else {
      for (let vi = 0; vi < jobs.length; vi++) {
        await renderJobLegacy(jobs[vi], vi);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("Batch export gagal:", e);
    useEditor.getState().patchExportState({ label: `Gagal: ${msg}` });
  } finally {
    batchEnded = true; // v1.4.6: kunci progres — tick zombie tak boleh menimpa 100%
    useEditor.setState({ clips: snapshot.clips, tracks: snapshot.tracks, assets: snapshot.assets, project: snapshot.project });
    // lepaskan elemen media sisa batch (hemat memori/dekoder) + bersihkan cache cover
    batchCoverCache.clear();
    engine.pruneElements();
    engine.syncSize();
    engine.pause();
    engine.seek(0);
    // tandai pekerjaan yang tak sempat selesai (batch berhenti karena error)
    for (const j of useEditor.getState().batchJobs) {
      if (j.status === "jalan" || j.status === "antre") useEditor.getState().patchBatchJob(j.id, { status: "gagal", label: "Terhenti" });
    }
    const auto = isAutoSaveActive();
    const stEnd = useEditor.getState();
    if (!stEnd.exportState.label.startsWith("Gagal")) {
      // v1.0.15: bila ada file yang gagal, jangan bilang "semua tersimpan ✓"
      if (failedCount > 0) {
        stEnd.patchExportState({ running: false, label: `Batch selesai — ${failedCount} file GAGAL ✗ (lihat keterangan merah di daftar)`, progress: 1 });
      } else {
        stEnd.patchExportState({ running: false, label: auto ? "Batch selesai — semua file tersimpan di folder pilihanmu ✓" : "Batch selesai", progress: 1 });
      }
    } else {
      stEnd.patchExportState({ running: false, progress: 1 });
    }
    // v1.0.16: bunyi tuntas + notifikasi Windows + auto-shutdown (bila diaktifkan)
    if (pl.soundDone) chime("done");
    const shutOk = pl.autoShutdown && isDesktopFS() && failedCount === 0;
    if (!shutOk && isDesktopFS() && (pl.soundDone || failedCount > 0)) {
      void notifyDesktop("NOVACUT Studio", failedCount > 0 ? `Batch selesai — ${failedCount} file gagal ✗` : `Batch selesai — semua file tersimpan ✓`);
    }
    if (shutOk) {
      const st3 = useEditor.getState();
      st3.patchExportState({ label: `${st3.exportState.label} — PC akan mati dalam 60 detik` });
      void shutdownPC();
    }
  }
}
