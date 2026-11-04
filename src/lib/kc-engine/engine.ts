// NOVACUT Studio - Render engine: playback multi-layer di canvas + mixing audio

import { fontStack, fmtTime, partLabel } from "./constants";
import { getMusicBuffer, musicDefById } from "./music";
import { useEditor, totalDuration, type EditorState } from "./store";
import { drawKcOverlay } from "./kc-overlays";
import { wrapCanvasText } from "./textwrap";
import type { Clip, MediaAsset, TextData, Track } from "./types";
import { applyGradeTints, applyOverlays, applyTransition, clipTransform, drawCover, easeOut, framingLayout, gradeFilterString } from "./visual";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** batasi fraksi geser posisi teks (-0.45..0.45 layar) */
function clampOff(v?: number): number {
  return typeof v === "number" && isFinite(v) ? Math.max(-0.45, Math.min(0.45, v)) : 0;
}

/**
 * v1.0.17 — Ruang kerja per tugas render untuk komposisi PARALEL.
 * Bila diisi, composeFrame/drawMediaFrame memakai kanvas bantu MILIK tugas
 * (tmpA/tmpB/scratch) dan SUMBER VIDEO dari frame WebCodecs (videoFrames:
 * VideoFrame hasil VideoDecoder murni) alih-alih elemen <video> — tanpa ini
 * tugas paralel akan saling menimpa kanvas bantu engine yang dipakai bersama.
 */
export interface ComposeWork {
  /** key = clip.assetId (atau clip.id) → frame yang sedang dirender */
  videoFrames?: Map<string, VideoFrame | null>;
  tmpA?: HTMLCanvasElement;
  tmpB?: HTMLCanvasElement;
  scratch?: HTMLCanvasElement;
}

/** status render mandiri untuk satu pekerjaan export (dipakai mode paralel:
 * tiap video punya klip/track/asset sendiri tanpa menyentuh timeline global) */
export interface RenderState {
  clips: Clip[];
  tracks: Track[];
  assets: MediaAsset[];
  project: { width: number; height: number };
}

/**
 * Gambar satu blok teks ke kanvas — dipakai bersama oleh klip teks timeline,
 * pratinjau langsung menu Teks & hasil export. `local` = detik sejak teks mulai,
 * `absT` = waktu absolut (animasi neon/typewriter), `dur` = durasi tampil.
 * Mendukung geser posisi: offX/offY (blok judul) & subOffX/subOffY (deskripsi).
 */
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  td: TextData,
  local: number,
  absT: number,
  dur = 4
) {
  const inDur = Math.min(0.55, dur * 0.35);
  const inP = clamp(local / Math.max(0.05, inDur), 0, 1);
  const outP = clamp((dur - local) / Math.min(0.4, dur * 0.3), 0, 1);
  let alpha = Math.min(inP >= 1 ? 1 : inP, outP);
  let dy = 0;
  let scale = 1;

  const content = td.content;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Word-wrap + auto-shrink: teks/judul panjang otomatis bersambung ke baris
  // bawah; bila blok teks lebih tinggi dari layar, ukuran font diperkecil
  // otomatis sampai semuanya muat dan terbaca.
  const maxW = w * 0.86;
  const computeLayout = (sz: number) => {
    ctx.font = `900 ${sz}px ${fontStack(td.font)}`;
    const ls = wrapCanvasText(ctx, content, maxW);
    // ukuran & font baris kedua (deskripsi) bisa diatur sendiri (menu Teks)
    const subSz = td.subSize && td.subSize > 0 ? td.subSize * h : sz * 0.42;
    let subs: string[] = [];
    if (td.sub) {
      ctx.font = `600 ${subSz}px ${fontStack(td.subFont || "sans")}`;
      subs = wrapCanvasText(ctx, td.sub, maxW);
    }
    const lh = sz * 1.12;
    const bh = ls.length * lh + (subs.length ? subs.length * subSz * 1.3 + subSz * 0.25 : 0);
    return { ls, subs, subSz, lineH: lh, blockH: bh };
  };
  let size = td.size * h;
  let layout = computeLayout(size);
  for (let guard = 0; layout.blockH > h * 0.8 && guard < 8; guard++) {
    size *= 0.86;
    layout = computeLayout(size);
  }
  const { ls: lines, subs, subSz: subSize, lineH, blockH } = layout;
  ctx.font = `900 ${size}px ${fontStack(td.font)}`;
  // geser posisi vertikal (kolom posisi di menu Teks) — latar bar ikut bergeser
  const offY = clampOff(td.offY) * h;
  const posYBase = td.pos === "top" ? h * 0.16 + blockH / 2 : td.pos === "center" ? h / 2 : h * 0.86 - blockH / 2;
  const posY = posYBase + offY;

  switch (td.anim) {
    case "rise":
      dy = (1 - easeOut(inP)) * h * 0.09;
      alpha *= inP;
      break;
    case "slam": {
      const p = easeOut(Math.min(1, inP * 1.15));
      scale = 1 + (1 - p) * 1.6;
      alpha *= Math.min(1, inP * 2.2) * outP;
      if (local < 0.32 && inP >= 0.95) {
        dy = (Math.random() - 0.5) * 8;
      }
      break;
    }
    case "neon":
      alpha *= 0.78 + 0.22 * Math.abs(Math.sin(absT * 18));
      break;
    case "tracking": {
      alpha *= inP;
      break;
    }
    case "glitch":
      alpha *= inP;
      break;
    case "wipe":
      alpha = 1;
      break;
    default:
      alpha *= inP;
  }
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(w / 2, posY + dy);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.translate(-w / 2, -posY);

  // latar
  if (td.bg !== "none") {
    const padX = w * 0.03;
    const padY = size * 0.35;
    if (td.bg === "bar") {
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, posY + dy - blockH / 2 - padY, w, blockH + padY * 2);
    } else if (td.bg === "box") {
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      const bx = Math.max(size * 0.3, w / 2 - maxW / 2 - padX);
      ctx.beginPath();
      ctx.roundRect(bx, posY + dy - blockH / 2 - padY, w - bx * 2, blockH + padY * 2, 12);
      ctx.fill();
    } else if (td.bg === "gradient") {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(0,0,0,0.75)");
      g.addColorStop(0.4, "rgba(0,0,0,0)");
      g.addColorStop(0.75, "rgba(0,0,0,0.75)");
      g.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  const drawLines = (drawer: (ln: string, i: number) => void) => {
    lines.forEach((ln, i) => drawer(ln, i));
  };

  const baseY = posY + dy - blockH / 2 + lineH / 2;
  const yFor = (i: number) => baseY + i * lineH;

  if (td.bg === "none" && td.stroke) {
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineJoin = "round";
  }

  const paintLine = (ln: string, y: number) => {
    if (td.bg === "none" && td.stroke) ctx.strokeText(ln, w / 2, y);
    ctx.fillStyle = td.color;
    ctx.fillText(ln, w / 2, y);
  };

  // geser horizontal (kolom posisi kiri/kanan di menu Teks)
  const offX = clampOff(td.offX) * w;
  const subOffX = clampOff(td.subOffX ?? td.offX) * w;
  const subOffY = clampOff(td.subOffY) * h;

  ctx.save();
  ctx.translate(offX, 0);

  switch (td.anim) {
    case "typewriter": {
      const full = lines.join("\n");
      const nChars = Math.floor(full.length * Math.pow(inP, 0.85));
      let used = 0;
      drawLines((ln, i) => {
        const avail = Math.max(0, nChars - used);
        used += ln.length + 1;
        const shown = ln.slice(0, avail);
        const y = yFor(i);
        if (td.bg === "none" && td.stroke) {
          ctx.strokeText(shown, w / 2, y);
        }
        ctx.fillStyle = td.color;
        ctx.fillText(shown, w / 2, y);
        if (avail <= ln.length && avail > 0 && Math.floor(absT * 3) % 2 === 0) {
          const cw = ctx.measureText(shown).width;
          ctx.fillRect(w / 2 + cw / 2 + 4, y - size * 0.42, size * 0.08, size * 0.84);
        }
      });
      break;
    }
    case "tracking": {
      const spread = (1 - easeOut(inP)) * size * 0.5;
      drawLines((ln, i) => {
        const chars = [...ln];
        const widths = chars.map((ch) => ctx.measureText(ch).width + spread);
        const totalW = widths.reduce((a, b) => a + b, 0);
        let x = w / 2 - totalW / 2;
        const y = yFor(i);
        for (let ci = 0; ci < chars.length; ci++) {
          if (td.bg === "none" && td.stroke) ctx.strokeText(chars[ci], x + widths[ci] / 2, y);
          ctx.fillStyle = td.color;
          ctx.fillText(chars[ci], x + widths[ci] / 2, y);
          x += widths[ci];
        }
      });
      break;
    }
    case "glitch": {
      drawLines((ln, i) => {
        const y = yFor(i);
        const jx = () => (Math.random() - 0.5) * size * 0.12 * (Math.random() > 0.7 ? 2.2 : 1);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = clamp(alpha, 0, 1) * 0.6;
        ctx.fillStyle = "#ff2d55";
        ctx.fillText(ln, w / 2 + jx(), y);
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(ln, w / 2 + jx(), y);
        ctx.restore();
        if (td.bg === "none" && td.stroke) ctx.strokeText(ln, w / 2, y);
        ctx.fillStyle = td.color;
        ctx.fillText(ln, w / 2 + jx() * 0.3, y);
      });
      break;
    }
    case "neon": {
      ctx.save();
      ctx.shadowColor = td.color;
      ctx.shadowBlur = size * 0.45;
      drawLines((ln, i) => {
        ctx.fillStyle = "#fff";
        ctx.fillText(ln, w / 2, yFor(i));
        ctx.fillText(ln, w / 2, yFor(i));
      });
      ctx.restore();
      break;
    }
    case "wipe": {
      const rev = easeOut(inP);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * rev, h);
      ctx.clip();
      drawLines((ln, i) => paintLine(ln, yFor(i)));
      ctx.restore();
      break;
    }
    default:
      drawLines((ln, i) => paintLine(ln, yFor(i)));
  }

  ctx.restore(); // akhir geser horizontal judul

  if (subs.length) {
    ctx.save();
    ctx.translate(subOffX, 0);
    ctx.font = `600 ${subSize}px ${fontStack(td.subFont || "sans")}`;
    const subLineH = subSize * 1.3;
    const sy0 = baseY + lines.length * lineH + subSize * 0.4 + subOffY;
    subs.forEach((sl, i) => {
      const sy = sy0 + i * subLineH;
      if (td.bg === "none" && td.stroke) {
        ctx.lineWidth = Math.max(2, subSize * 0.14);
        ctx.strokeText(sl, w / 2, sy);
      }
      ctx.fillStyle = td.color;
      ctx.fillText(sl, w / 2, sy);
    });
    ctx.restore();
  }
  ctx.restore();
}

function makeNoiseCanvas(w: number, h: number, alpha: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = alpha ? 255 : Math.random() * 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

class EditorEngine {
  canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private scratch = document.createElement("canvas");
  private tmpA = document.createElement("canvas");
  private tmpB = document.createElement("canvas");
  private grain = makeNoiseCanvas(256, 256, false);
  private tvNoise = makeNoiseCanvas(240, 135, true);
  private grainPattern: CanvasPattern | null = null;
  private els = new Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>();
  private gains = new Map<string, GainNode>();
  private mediaSrcs = new Map<string, MediaElementAudioSourceNode>();
  private musicSessions = new Map<string, { src: AudioBufferSourceNode; gain: GainNode; session: number }>();
  private loadingMusic = new Set<string>();
  private musicBuffers = new Map<string, AudioBuffer>();
  private previewSource: AudioBufferSourceNode | null = null;
  audioCtx: AudioContext | null = null;
  recDest: MediaStreamAudioDestinationNode | null = null;
  private session = 0;
  private raf = 0;
  private renderRaf = 0;
  private lastTs = 0;
  playing = false;
  private stopAt: number | null = null;
  private onDone: (() => void) | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    const { width, height } = useEditor.getState().project;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (this.ctx) {
      this.grainPattern = this.ctx.createPattern(this.grain, "repeat");
      this.renderFrame(useEditor.getState().playhead);
    }
  }

  syncSize() {
    if (!this.canvas) return;
    const { width, height } = useEditor.getState().project;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    // selalu render ulang: atribut kanvas bisa saja sudah diubah React (kanvan ter-reset)
    this.requestRender();
  }

  requestRender() {
    if (this.renderRaf) return;
    this.renderRaf = requestAnimationFrame(() => {
      this.renderRaf = 0;
      if (!this.playing) this.renderFrame(useEditor.getState().playhead);
    });
  }

  ensureAudio() {
    if (!this.audioCtx) {
      type WinAudio = Window & { webkitAudioContext?: typeof AudioContext };
      const AC = window.AudioContext || (window as WinAudio).webkitAudioContext;
      if (!AC) return;
      this.audioCtx = new AC();
      this.recDest = this.audioCtx.createMediaStreamDestination();
      // sambungkan gain yang sudah ada (dibuat sebelum export) ke perekam agar ikut terekam
      for (const g of this.gains.values()) {
        try {
          g.connect(this.recDest);
        } catch {
          /* ignore */
        }
      }
    }
    if (this.audioCtx.state === "suspended") void this.audioCtx.resume();
  }

  /** Rutekan audio elemen video/audio ke graph Web Audio (wajib agar ikut terekam saat export) */
  private routeElementAudio(key: string, el: HTMLVideoElement | HTMLAudioElement) {
    const ctx = this.audioCtx;
    if (!ctx || this.mediaSrcs.has(key)) return;
    try {
      const src = ctx.createMediaElementSource(el);
      const g = this.gainFor(key);
      if (g) src.connect(g);
      this.mediaSrcs.set(key, src);
    } catch {
      /* elemen sudah pernah dirutekan / tidak didukung */
    }
  }

  // ===== elemen media per klip =====
  /** kunci elemen media: SATU elemen per aset (bukan per klip) — mencegah
   * penumpukan dekoder/memori saat export & split banyak bagian (penyebab
   * hasil split ke-4 dst. layar hitam) */
  private elKey(clip: Clip): string {
    return `${clip.kind}:${clip.assetId ?? clip.id}`;
  }

  /** (dibuat publik: exporter kilat perlu elemen media untuk pump decode) */
  elFor(clip: Clip, assets?: MediaAsset[]): HTMLVideoElement | HTMLAudioElement | HTMLImageElement | null {
    const st = useEditor.getState();
    const asset = (assets ?? st.assets).find((a) => a.id === clip.assetId);
    if (!asset) return null;
    const key = this.elKey(clip);
    let el = this.els.get(key);
    if (el) return el;
    if (asset.musicId) return null; // musik pustaka: via AudioBuffer
    if (clip.kind === "video") {
      const v = document.createElement("video");
      v.src = asset.url;
      v.preload = "auto";
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      // render ulang saat frame pertama siap (agar preview tidak hitam)
      v.addEventListener("loadeddata", () => this.requestRender(), { once: true });
      el = v;
    } else if (clip.kind === "audio") {
      const a = document.createElement("audio");
      a.src = asset.url;
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      el = a;
    } else {
      const img = new Image();
      img.src = asset.url;
      // render ulang saat gambar selesai dimuat
      img.onload = () => this.requestRender();
      el = img;
    }
    this.els.set(key, el);
    return el;
  }

  gainFor(key: string): GainNode | null {
    if (!this.audioCtx) return null;
    let g = this.gains.get(key);
    if (!g) {
      g = this.audioCtx.createGain();
      g.connect(this.audioCtx.destination);
      if (this.recDest) g.connect(this.recDest);
      this.gains.set(key, g);
    }
    return g;
  }

  private clipVolume(clip: Clip, track: Track, local: number): number {
    const fi = clip.fadeIn > 0 ? clamp(local / clip.fadeIn, 0, 1) : 1;
    const fo = clip.fadeOut > 0 ? clamp((clip.duration - local) / clip.fadeOut, 0, 1) : 1;
    return clip.volume * (track.muted ? 0 : 1) * Math.min(fi, fo);
  }

  /** Sinkronkan elemen video/audio; kembalikan elemen siap digambar (video saja) */
  private syncMedia(clip: Clip, track: Track, t: number, playing: boolean, forDraw: boolean): HTMLVideoElement | null {
    const el = this.elFor(clip);
    if (!el || !(el instanceof HTMLVideoElement)) return null;
    const local = t - clip.start;
    const srcSeg = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
    const srcTime = clip.inPoint + ((local * clip.speed) % Math.max(0.033, srcSeg));
    const rate = clamp(clip.speed, 0.25, 4);
    if (el.playbackRate !== rate) {
      try {
        el.playbackRate = rate;
      } catch {
        /* ignore */
      }
    }
    const v = this.clipVolume(clip, track, local);
    if (this.audioCtx) {
      // via graph: suara tetap terdengar & ikut terekam saat export
      this.routeElementAudio(this.elKey(clip), el);
      el.volume = 1;
      el.muted = false;
      const g = this.gainFor(this.elKey(clip));
      if (g) g.gain.value = v;
    } else {
      const g = this.gainFor(this.elKey(clip));
      if (g) g.gain.value = v;
      else {
        el.volume = clamp(v, 0, 1);
        el.muted = track.muted;
      }
    }
    if (playing) {
      if (el.paused) {
        try {
          el.currentTime = Math.min(srcTime, Math.max(0, (el.duration || 0) - 0.02));
        } catch {
          /* ignore */
        }
        void el.play().catch(() => {});
      } else if (Math.abs(el.currentTime - srcTime) > 0.35 && !el.seeking) {
        try {
          el.currentTime = Math.min(srcTime, Math.max(0, (el.duration || 0) - 0.02));
        } catch {
          /* ignore */
        }
      }
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - srcTime) > 0.03 && !el.seeking) {
        try {
          el.currentTime = Math.min(srcTime, Math.max(0, (el.duration || 0) - 0.02));
        } catch {
          /* ignore */
        }
      }
    }
    return forDraw ? el : null;
  }

  private syncAudioEl(clip: Clip, track: Track, t: number, playing: boolean) {
    const el = this.elFor(clip);
    if (!el || !(el instanceof HTMLAudioElement)) return;
    const local = t - clip.start;
    const srcTime = clip.inPoint + local * clip.speed;
    const v = this.clipVolume(clip, track, local);
    if (this.audioCtx) {
      this.routeElementAudio(this.elKey(clip), el);
      el.volume = 1;
      el.muted = false;
      const g = this.gainFor(this.elKey(clip));
      if (g) g.gain.value = v;
    } else {
      const g = this.gainFor(this.elKey(clip));
      if (g) g.gain.value = v;
      else {
        el.volume = clamp(v, 0, 1);
        el.muted = track.muted;
      }
    }
    if (playing) {
      if (el.paused) {
        try {
          el.currentTime = srcTime;
        } catch {
          /* ignore */
        }
        void el.play().catch(() => {});
      } else if (Math.abs(el.currentTime - srcTime) > 0.35 && !el.seeking) {
        try {
          el.currentTime = srcTime;
        } catch {
          /* ignore */
        }
      }
    } else if (!el.paused) el.pause();
  }

  private async loadMusic(assetId: string, musicId: string) {
    if (this.musicBuffers.has(assetId) || this.loadingMusic.has(assetId)) return;
    this.loadingMusic.add(assetId);
    const def = musicDefById(musicId);
    if (!def) return;
    try {
      const buf = await getMusicBuffer(def);
      this.musicBuffers.set(assetId, buf);
      this.requestRender();
    } finally {
      this.loadingMusic.delete(assetId);
    }
  }

  private stopMusicSession(clipId: string) {
    const m = this.musicSessions.get(clipId);
    if (m) {
      try {
        m.src.stop();
      } catch {
        /* ignore */
      }
      this.musicSessions.delete(clipId);
    }
  }

  private syncMusic(clip: Clip, track: Track, t: number, playing: boolean) {
    const st = useEditor.getState();
    const asset = st.assets.find((a) => a.id === clip.assetId);
    if (!asset?.musicId) return;
    const buf = this.musicBuffers.get(asset.id);
    if (!buf) {
      void this.loadMusic(asset.id, asset.musicId);
      return;
    }
    const local = t - clip.start;
    const v = this.clipVolume(clip, track, local);
    if (!playing) {
      this.stopMusicSession(clip.id);
      return;
    }
    let m = this.musicSessions.get(clip.id);
    if (!m || m.session !== this.session) {
      this.stopMusicSession(clip.id);
      if (!this.audioCtx) return;
      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.audioCtx.createGain();
      gain.gain.value = v;
      src.connect(gain);
      gain.connect(this.audioCtx.destination);
      if (this.recDest) gain.connect(this.recDest);
      const offset = local % buf.duration;
      try {
        src.start(0, Math.max(0, offset));
      } catch {
        return;
      }
      m = { src, gain, session: this.session };
      this.musicSessions.set(clip.id, m);
    } else {
      m.gain.gain.value = v;
    }
  }

  // ===== menggambar klip =====
  private drawMediaFrame(ctx: CanvasRenderingContext2D, clip: Clip, t: number, w: number, h: number, noSync = false, rs?: RenderState, work?: ComposeWork) {
    const stStore = useEditor.getState();
    const st = rs ? { ...stStore, clips: rs.clips, tracks: rs.tracks, assets: rs.assets } : stStore;
    const track = st.tracks.find((tr) => tr.id === clip.trackId);
    const local = t - clip.start;
    const progress = clamp(local / Math.max(0.01, clip.duration), 0, 1);
    const asset = st.assets.find((a) => a.id === clip.assetId);

    if (clip.kind === "text" && clip.text) {
      this.drawTextClip(ctx, clip, t, w, h);
      return;
    }
    if (!asset) return;

    let src: CanvasImageSource | null = null;
    let sw = 0;
    let sh = 0;
    if (clip.kind === "video") {
      // v1.0.17: bila work.videoFrames berisi frame utk asset ini (mesin Turbo
      // WebCodecs), gambar langsung dari VideoFrame hasil decoder — tanpa elemen video
      const vf = work?.videoFrames?.get(clip.assetId ?? clip.id);
      if (vf) {
        src = vf;
        sw = vf.displayWidth;
        sh = vf.displayHeight;
      } else {
        // noSync: elemen sudah diposisikan exporter (pump/seek) — ambil saja elemennya
        const el = noSync ? (this.elFor(clip, rs?.assets) as HTMLVideoElement | null) : this.syncMedia(clip, track ?? { id: "", kind: "video", name: "", muted: false, hidden: false }, t, this.playing, true);
        if (el && el.videoWidth) {
          src = el;
          sw = el.videoWidth;
          sh = el.videoHeight;
        }
      }
    } else if (clip.kind === "image") {
      const el = this.elFor(clip, rs?.assets);
      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth) {
        src = el;
        sw = el.naturalWidth;
        sh = el.naturalHeight;
      }
    }

    if (src) {
      const fx = clip.effects;
      const tr = clipTransform(fx, local, progress, t);
      ctx.save();
      ctx.filter = gradeFilterString(fx);
      // kadro: zoom & geser per klip (zoom 1 = ukuran asli / utuh, tanpa zoom otomatis)
      const layout = framingLayout(sw, sh, w, h, clip.zoom ?? 1);
      const panX = Math.max(-1, Math.min(1, clip.panX ?? 0));
      const panY = Math.max(-1, Math.min(1, clip.panY ?? 0));
      const dx = (w - layout.dw) / 2 + panX * layout.overX + tr.dx;
      const dy = (h - layout.dh) / 2 + panY * layout.overY + tr.dy;
      ctx.globalAlpha = 1;
      ctx.drawImage(src, dx, dy, layout.dw, layout.dh);
      ctx.restore();
      ctx.filter = "none";
      applyGradeTints(ctx, fx, w, h);
      applyOverlays(ctx, fx, w, h, { t, local, progress, grainPattern: this.grainPattern, scratch: work?.scratch ?? this.scratch });
    }
  }

  private drawTextClip(ctx: CanvasRenderingContext2D, clip: Clip, t: number, w: number, h: number) {
    if (!clip.text) return;
    drawTextOverlay(ctx, w, h, clip.text, t - clip.start, t, clip.duration);
  }

  // ===== kompositor utama =====
  renderFrame(t: number) {
    this.composeFrame(this.ctx, t, false);
  }

  /**
   * Komposisi satu frame ke kanvas mana pun.
   * noSync=false (preview): elemen video/audio ikut disinkronkan seperti biasa.
   * noSync=true (render kilat offscreen): posisi media DIATUR PANGGIL (pump/seek
   * oleh exporter) — composeFrame HANYA menggambar, tanpa menyentuh pemutaran.
   */
  composeFrame(ctx: CanvasRenderingContext2D | null, t: number, noSync: boolean, rs?: RenderState, work?: ComposeWork) {
    if (!ctx) return;
    const stStore = useEditor.getState();
    const st = rs
      ? { ...stStore, clips: rs.clips, tracks: rs.tracks, assets: rs.assets, textPreview: false, exportState: stStore.exportState }
      : stStore;
    const w = rs ? rs.project.width : this.canvas?.width || stStore.project.width;
    const h = rs ? rs.project.height : this.canvas?.height || stStore.project.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const clips = st.clips;
    if (!clips.length) {
      this.drawBrand(ctx, w, h);
      return;
    }
    // di ujung timeline, tampilkan frame terakhir (bukan layar hitam)
    const total = totalDuration(clips);
    const tt = t >= total && total > 0 ? Math.max(0, total - 0.001) : t;

    for (const track of st.tracks) {
      if (track.kind === "audio") {
        if (noSync) continue; // audio dirender terpisah via PCM di exporter kilat
        for (const c of clips) {
          if (c.trackId !== track.id) continue;
          if (tt < c.start || tt >= c.start + c.duration) continue;
          const asset = st.assets.find((a) => a.id === c.assetId);
          if (asset?.musicId) this.syncMusic(c, track, tt, this.playing);
          else this.syncAudioEl(c, track, tt, this.playing);
        }
        continue;
      }
      if (track.hidden) continue;
      const active = [...clips].filter((c) => c.trackId === track.id && c.start <= tt && tt < c.start + c.duration).sort((a, b) => a.start - b.start).pop();
      if (!active) continue;

      // Track teks: SEMUA klip teks yang aktif digambar bertumpuk (judul di atas
      // + part di bawah bisa tampil bersamaan; sebelumnya saling menimpa sehingga
      // salah satunya tidak pernah terlihat di hasil render).
      if (track.kind === "text") {
        const actives = clips.filter((c) => c.trackId === track.id && c.start <= tt && tt < c.start + c.duration).sort((a, b) => a.start - b.start);
        for (const tc of actives) this.drawMediaFrame(ctx, tc, tt, w, h, noSync, rs, work);
        continue;
      }

      let donor: Clip | null = null;
      let transP = 0;
      if (active.transition && active.start > 0.001) {
        const dur = Math.max(0.1, active.transition.duration);
        const localT = tt - active.start;
        if (localT < dur) {
          donor = clips.find((c) => c.trackId === track.id && c.id !== active.id && Math.abs(c.start + c.duration - active.start) < 0.06) ?? null;
          if (donor) transP = clamp(localT / dur, 0, 1);
        }
      }

      if (donor) {
        const tmpA = work?.tmpA ?? this.tmpA;
        const tmpB = work?.tmpB ?? this.tmpB;
        tmpA.width = w;
        tmpA.height = h;
        tmpB.width = w;
        tmpB.height = h;
        const aCtx = tmpA.getContext("2d");
        const bCtx = tmpB.getContext("2d");
        if (aCtx && bCtx) {
          aCtx.fillStyle = "#000";
          aCtx.fillRect(0, 0, w, h);
          bCtx.fillStyle = "#000";
          bCtx.fillRect(0, 0, w, h);
          this.drawMediaFrame(aCtx, donor, tt, w, h, noSync, rs, work);
          this.drawMediaFrame(bCtx, active, tt, w, h, noSync, rs, work);
          applyTransition(active.transition!.type, ctx, tmpA, tmpB, transP, w, h, {
            scratch: work?.scratch ?? this.scratch,
            noise: this.tvNoise,
            accent: "#22d3ee",
          });
        }
      } else {
        this.drawMediaFrame(ctx, active, tt, w, h, noSync, rs, work);
      }
    }

    // pratinjau LANGSUNG tulisan otomatis (judul/deskripsi/part) dari menu Teks —
    // perubahan ukuran/posisi langsung terlihat di preview tanpa perlu export
    if (st.textPreview && !st.exportState.running && !noSync) {
      this.drawAutoTextPreview(ctx, w, h, tt);
    }

    // ===== KolosalCut v1.4.0: frame neon/minimalis + bar sinema =====
    // Digambar paling atas agar identik dengan pipeline FFmpeg lama.
    drawKcOverlay(ctx, w, h, tt, stStore.kcFrame);
  }

  /** Gambar tulisan otomatis (judul+deskripsi di atas, part di bawah) di atas
   * frame preview — pakai gaya, ukuran & posisi yang sama persis dengan hasil
   * Export & Split dari Playlist. */
  private drawAutoTextPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const st = useEditor.getState();
    const texts = st.texts;
    const fontAuto = texts.fontAuto || "condensed";
    const rel = (v: number | undefined, def: number) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.max(0.012, Math.min(0.2, v)) : def);
    const pct = (v: number | undefined) => clampOff(typeof v === "number" && isFinite(v) ? v / 100 : 0);
    const hasTitle = !!(texts.title && texts.title.trim());
    const hasDesc = !!(texts.description && texts.description.trim());
    const titleOn = st.exportSettings.showTitleText || st.playlistExport.titleDuringVideo || st.playlistExport.showTitleScreen;
    const partOn = st.exportSettings.autoPartText || st.playlistExport.showPartText;
    if ((hasTitle || hasDesc) && titleOn) {
      drawTextOverlay(
        ctx,
        w,
        h,
        {
          content: texts.title || "",
          sub: hasDesc ? texts.description : undefined,
          size: rel(texts.titleSize, 0.042),
          subSize: rel(texts.descSize, 0.026),
          color: "#ffffff",
          font: fontAuto,
          subFont: fontAuto,
          anim: "rise",
          pos: "top",
          bg: "none",
          stroke: true,
          offX: pct(texts.titleX),
          offY: pct(texts.titleY),
          subOffX: pct(texts.descX),
          subOffY: pct(texts.descY),
        },
        10,
        t,
        12
      );
    }
    if (partOn) {
      const n = Math.max(1, texts.parts || 1);
      drawTextOverlay(
        ctx,
        w,
        h,
        {
          content: partLabel(texts.labelStyle || "Part", n, n, true),
          size: rel(texts.partSize, 0.052),
          color: "#ffffff",
          font: fontAuto,
          anim: "slam",
          pos: "bottom",
          bg: "bar",
          stroke: true,
          offX: pct(texts.partX),
          offY: pct(texts.partY),
        },
        10,
        t,
        12
      );
    }
  }

  private drawBrand(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#05060f");
    g.addColorStop(0.5, "#0b1030");
    g.addColorStop(1, "#12042a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#eafcff";
    ctx.font = `900 ${h * 0.13}px ${fontStack("display")}`;
    ctx.fillText("NOVACUT", w / 2, h * 0.44);
    ctx.shadowBlur = 0;
    ctx.font = `600 ${h * 0.038}px ${fontStack("sans")}`;
    ctx.fillStyle = "#67e8f9";
    ctx.fillText("Impor media dari panel kiri untuk mulai mengedit", w / 2, h * 0.56);
    ctx.restore();
  }

  // ===== transport =====
  play(opts?: { stopAt?: number; onDone?: () => void }) {
    this.ensureAudio();
    this.stopAt = opts?.stopAt ?? null;
    this.onDone = opts?.onDone ?? null;
    const st = useEditor.getState();
    const end = this.stopAt ?? totalDuration(st.clips);
    if (st.playhead >= end - 0.02) st.setPlayhead(0);
    this.session++;
    this.playing = true;
    st.setPlaying(true);
    this.lastTs = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (ts: number) => {
    if (!this.playing) return;
    const dt = Math.min(0.2, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    const st = useEditor.getState();
    const end = this.stopAt ?? totalDuration(st.clips);
    let t = st.playhead + dt;
    if (t >= end) {
      t = end;
      st.setPlayhead(t);
      this.renderFrame(t);
      this.pause();
      const cb = this.onDone;
      this.onDone = null;
      this.stopAt = null;
      if (cb) setTimeout(cb, 120);
      return;
    }
    st.setPlayhead(t);
    this.renderFrame(t);
    this.raf = requestAnimationFrame(this.loop);
  };

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    useEditor.getState().setPlaying(false);
    for (const [, el] of this.els) {
      if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) el.pause();
    }
    for (const id of [...this.musicSessions.keys()]) this.stopMusicSession(id);
    this.session++;
    this.requestRender();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    const st = useEditor.getState();
    const end = Math.max(0.001, totalDuration(st.clips));
    const tt = clamp(t, 0, end);
    st.setPlayhead(tt);
    if (this.playing) this.session++;
    this.renderFrame(tt);
  }

  /**
   * Siapkan elemen video/audio SEBELUM perekaman dimulai: posisi sumber sudah
   * di-seek dan frame pertama siap. Tanpa ini, konten mulai telat (layar hitam
   * beberapa detik setelah cover) sehingga detik terakhir konten terpotong —
   * inilah penyebab "detik cover memakan detik video".
   */
  async prepareUpcoming(windowSec = 12) {
    const st = useEditor.getState();
    const t = st.playhead;
    const jobs: Promise<void>[] = [];
    for (const clip of st.clips) {
      if (clip.kind !== "video" && clip.kind !== "audio") continue;
      const active = clip.start <= t + 0.02 && t < clip.start + clip.duration;
      const upcoming = clip.start > t + 0.02 && clip.start <= t + windowSec;
      if (!active && !upcoming) continue;
      const el = this.elFor(clip);
      if (!el || !(el instanceof HTMLVideoElement || el instanceof HTMLAudioElement)) continue;
      const local = active ? t - clip.start : 0;
      const srcSeg = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
      const srcTime =
        clip.kind === "video"
          ? clip.inPoint + ((local * clip.speed) % Math.max(0.033, srcSeg))
          : clip.inPoint + local * clip.speed;
      const target = Math.max(0, Math.min(srcTime, (el.duration || srcTime) - 0.02));
      if (el.readyState >= 2 && el.paused && Math.abs(el.currentTime - target) < 0.08) continue;
      jobs.push(
        new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener("seeked", finish);
            resolve();
          };
          el.addEventListener("seeked", finish);
          try {
            el.currentTime = target;
          } catch {
            finish();
            return;
          }
          window.setTimeout(finish, 1800);
        })
      );
    }
    if (!jobs.length) return;
    await Promise.race([Promise.all(jobs), sleep(2300)]);
    await sleep(80);
  }

  /** Lepas elemen media yang tidak dipakai (hemat memori/dekoder saat batch export).
   * Elemen dibuat ulang otomatis saat dibutuhkan lagi. */
  pruneElements(keep?: Set<string>) {
    for (const [key, el] of [...this.els]) {
      if (keep?.has(key)) continue;
      this.els.delete(key);
      if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
        try {
          el.pause();
        } catch {
          /* ignore */
        }
        try {
          el.removeAttribute("src");
          el.load();
        } catch {
          /* ignore */
        }
      }
    }
    for (const key of [...this.mediaSrcs.keys()]) {
      if (!keep?.has(key)) this.mediaSrcs.delete(key);
    }
  }

  // ===== preview musik =====
  async previewMusic(musicId: string) {
    this.ensureAudio();
    this.stopPreview();
    const def = musicDefById(musicId);
    if (!def || !this.audioCtx) return;
    const buf = await getMusicBuffer(def);
    if (!this.audioCtx) return;
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    const g = this.audioCtx.createGain();
    g.gain.value = 0.85;
    src.connect(g).connect(this.audioCtx.destination);
    src.start();
    this.previewSource = src;
  }

  stopPreview() {
    if (this.previewSource) {
      try {
        this.previewSource.stop();
      } catch {
        /* ignore */
      }
      this.previewSource = null;
    }
  }

  captureStream(fps = 30): MediaStream | null {
    if (!this.canvas || typeof this.canvas.captureStream !== "function") return null;
    return this.canvas.captureStream(fps);
  }
}

export const engine = new EditorEngine();

if (typeof window !== "undefined") {
  // gambar ulang saat font bundel selesai dimuat (preview memakai font asli)
  window.addEventListener("novacut:fonts-ready", () => engine.requestRender());
}

export function projectDuration(st: EditorState): number {
  return totalDuration(st.clips);
}

export function timeDisplay(t: number): string {
  return fmtTime(t, true);
}
