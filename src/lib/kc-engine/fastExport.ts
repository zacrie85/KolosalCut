// NOVACUT Studio - MESIN RENDER KILAT (WebCodecs, offscreen)
//
// Bedanya dengan export lama (MediaRecorder):
//  - Video TIDAK diputar di layar — frame dikomposisi ke kanvas offscreen.
//  - Decode dipompa secepat mungkin dengan LAJU ADAPTIF (playbackRate hingga 16x,
//    menyesuaikan jarak ke frame target) lalu tiap frame output diberi timestamp
//    EKSPLISIT, jadi durasi & gerakan hasil selalu benar walau encode jauh lebih
//    cepat dari realtime (5-10x tergantung perangkat).
//  - Audio dicampur dari PCM (decodeAudioData) dan di-encode langsung —
//    sinkron dengan video karena keduanya memakai peta waktu sumber yang sama.
//  - Bisa menjalankan beberapa video SEKALIGUS (paralel, lihat exporter.ts).
//
// Bila WebCodecs tidak tersedia (Electron lama), exporter.ts otomatis
// memakai jalur rekam real-time lama (kompatibilitas).

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target, StreamTarget as Mp4StreamTarget } from "mp4-muxer";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget, StreamTarget as WebmStreamTarget } from "webm-muxer";
import { engine, type RenderState } from "./engine";
import { ensureAppFonts } from "./fonts";
import { DiskFileWriter } from "./fsBridge";
import { getMusicBuffer, musicDefById } from "./music";
import { useEditor, totalDuration } from "./store";
import type { Clip, MediaAsset, Track } from "./types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface FastSupport {
  /** codec video terpilih, mis. "avc1.42E01E" */
  videoCodec: string;
  /** 'avc' (mp4) atau 'vp9' */
  videoMuxCodec: "avc" | "vp9";
  /** codec audio: "mp4a.40.2" | "opus" | null (tanpa audio) */
  audioCodec: string | null;
  /** 'mp4' atau 'webm' */
  container: "mp4" | "webm";
  ext: ".mp4" | ".webm";
}

let supportCache: Promise<FastSupport | null> | null = null;

/** Cek dukungan WebCodecs sekali per sesi; null = tidak didukung -> fallback jalur lama */
export function fastSupported(): Promise<FastSupport | null> {
  if (!supportCache) supportCache = probe();
  return supportCache;
}

async function probe(): Promise<FastSupport | null> {
  try {
    if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null;
    const w = 1280;
    const h = 720;
    const vCandidates: { codec: string; mux: "avc" | "vp9" }[] = [
      { codec: "avc1.42E01E", mux: "avc" },
      { codec: "avc1.4D0028", mux: "avc" },
      { codec: "avc1.640028", mux: "avc" },
      { codec: "vp09.00.10.08", mux: "vp9" },
    ];
    let video: { codec: string; mux: "avc" | "vp9" } | null = null;
    for (const c of vCandidates) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec: c.codec, width: w, height: h, bitrate: 8_000_000, framerate: 30 });
        if (s.supported) {
          video = c;
          break;
        }
      } catch {
        /* coba kandidat berikutnya */
      }
    }
    if (!video) return null;

    let audioCodec: string | null = null;
    if (typeof AudioEncoder !== "undefined" && typeof AudioData !== "undefined") {
      for (const codec of ["mp4a.40.2", "opus"]) {
        try {
          const s = await AudioEncoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192_000 });
          if (s.supported) {
            audioCodec = codec;
            break;
          }
        } catch {
          /* lanjut */
        }
      }
    }
    if (video.mux === "avc") {
      return { videoCodec: video.codec, videoMuxCodec: "avc", audioCodec, container: "mp4", ext: ".mp4" };
    }
    // video VP9: masih bisa MP4, tapi WebM lebih aman untuk pemutar lama
    return { videoCodec: video.codec, videoMuxCodec: "vp9", audioCodec: audioCodec === "mp4a.40.2" ? "opus" : audioCodec, container: "webm", ext: ".webm" };
  } catch {
    return null;
  }
}

interface AudioClipSrc {
  /** v1.0.14: PCM MONO hasil mixdown — film 1 jam stereo 48 kHz butuh ~2,7 GB,
   * mono cukup ~1,35 GB. Mixdown dilakukan SEKALI saat decode, bukan saat mixing. */
  mono: Float32Array | null;
  /** AudioBuffer asli (khusus musik pustaka — pendek) */
  buffer: AudioBuffer | null;
  sampleRate: number;
}

/**
 * decode audio satu aset (cache per sesi export).
 * v1.0.14: hasil decode langsung di-mixdown MONO lalu disimpan — hemat memori
 * ~50%, dan audio besar tidak pernah ditahan dua kali (stereo + mono).
 */
export class AudioDecodeCache {
  private map = new Map<string, AudioClipSrc>();
  /** v1.0.17: decode yang SEDANG berjalan — segmen paralel film yang sama
   * menunggu decode yang sama, bukan decode ulang (race tanpa ini = RAM 2-3x) */
  private inflight = new Map<string, Promise<AudioClipSrc>>();
  constructor(private ctx: OfflineAudioContext) {}

  async get(assetId: string, url: string): Promise<AudioClipSrc> {
    const hit = this.map.get(assetId);
    if (hit) return hit;
    const running = this.inflight.get(assetId);
    if (running) return running;
    const job = (async (): Promise<AudioClipSrc> => {
      let src: AudioClipSrc = { mono: null, buffer: null, sampleRate: this.ctx.sampleRate };
      try {
        const res = await fetch(url);
        const ab = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(ab);
        const n = buf.length;
        const mono = new Float32Array(n);
        const c0 = buf.getChannelData(0);
        const c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
        if (c1) {
          for (let i = 0; i < n; i++) mono[i] = (c0[i] + c1[i]) * 0.5;
        } else {
          mono.set(c0);
        }
        src = { mono, buffer: null, sampleRate: buf.sampleRate };
      } catch {
        src = { mono: null, buffer: null, sampleRate: this.ctx.sampleRate };
      }
      this.map.set(assetId, src);
      return src;
    })();
    this.inflight.set(assetId, job);
    try {
      return await job;
    } finally {
      this.inflight.delete(assetId);
    }
  }

  dispose() {
    this.map.clear();
    this.inflight.clear();
  }
}

/** v1.0.16: envelope RMS kasar (per ±100 ms) dari PCM mono — untuk smart split.
 * Satu kali lewat pada seluruh array; hasilnya puluhan KB saja. */
export function silenceEnvelope(mono: Float32Array, sampleRate: number): { rms: Float32Array; sec: number } {
  const per = Math.max(1, Math.round(sampleRate * 0.1));
  const n = Math.max(1, Math.floor(mono.length / per));
  const rms = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    const s0 = b * per;
    const s1 = Math.min(mono.length, s0 + per);
    let sum = 0;
    for (let i = s0; i < s1; i++) {
      const v = mono[i];
      sum += v * v;
    }
    rms[b] = Math.sqrt(sum / Math.max(1, s1 - s0));
  }
  return { rms, sec: per / sampleRate };
}

/**
 * v1.0.16: SMART SPLIT — geser tiap batas bagian (kecuali tepi) ke bucket
 * paling sunyi dalam ±8 detik (waktu SUMBER). Bila RMS terendah tidak jauh
 * di bawah median (tidak ada jeda nyata), batas dibiarkan agar tidak berpindah
 * sembarangan. Output tetap berurutan & berjarak aman dari batas tetangga.
 *
 * @param speed laju klip playlist (waktu timeline = waktu sumber / speed)
 * @param durSumber durasi sumber (detik) — batas di luar cakupan dibiarkan
 */
export function adjustRangesToSilence(
  ranges: { start: number; end: number }[],
  mono: Float32Array,
  sampleRate: number,
  speed: number,
  durSumber: number,
): { start: number; end: number }[] {
  const { rms, sec } = silenceEnvelope(mono, sampleRate);
  const out = ranges.map((r) => ({ ...r }));
  const WIN = 8; // detik sumber
  for (let k = 0; k < out.length - 1; k++) {
    const b = out[k].end;
    const s = b * Math.max(0.05, speed);
    if (s <= 1 || s >= durSumber - 0.5) continue; // di luar audio sumber — biarkan
    const lo = Math.max(0, s - WIN);
    const hi = Math.min(durSumber - 0.25, s + WIN);
    const i0 = Math.max(0, Math.floor(lo / sec));
    const i1 = Math.min(rms.length - 1, Math.ceil(hi / sec));
    if (i1 <= i0) continue;
    const win: number[] = [];
    for (let i = i0; i <= i1; i++) win.push(rms[i]);
    win.sort((a, c) => a - c);
    const med = win[Math.floor(win.length / 2)] || 0;
    let best = i0;
    for (let i = i0; i <= i1; i++) if (rms[i] < rms[best]) best = i;
    if (med > 0 && rms[best] > med * 0.72) continue; // tak ada jeda jelas
    const sNew = Math.min(hi, Math.max(lo, (best + 0.5) * sec));
    const bNew = sNew / Math.max(0.05, speed);
    // jaga jarak aman dari batas tetangga (±8% panjang gabungan, min 3 dtk)
    const prev = out[k].start;
    const next = out[k + 1].end;
    const minGap = Math.min(15, Math.max(3, (next - prev) * 0.08));
    out[k].end = Math.min(next - minGap, Math.max(prev + minGap, bNew));
    out[k + 1].start = out[k].end;
  }
  return out;
}

/** v1.0.15: antrean tulis-disk berurutan utk StreamTarget BAWAAN muxer.
 * PENTING: mp4-muxer/webm-muxer hanya menerima target yang merupakan instance
 * kelas `Target` miliknya — kelas buatan sendiri (DiskTarget di v1.0.14) membuat
 * SEMUA export langsung gagal: "The target must be provided and an instance
 * of Target". Kelas ini hanya menjembatani callback onData -> IPC pwrite:
 * potongan ditulis berurutan pada posisi absolutnya, error tulis ditahan dan
 * dilempar saat flush() agar file tidak ditutup dalam keadaan korup.
 * v1.0.17: diekspor — dipakai juga mesin Turbo. */
export const DISK_CHUNK = 8 * 1024 * 1024; // 8 MB per potongan IPC — hemat RAM & hemat pesan

export class DiskWriteChain {
  private chain: Promise<void> = Promise.resolve();
  private err: Error | null = null;
  constructor(private w: DiskFileWriter) {}

  /** callback `onData` StreamTarget (tanda tangan wajib: data, position) */
  onData = (data: Uint8Array, position: number): void => {
    if (this.err) return;
    this.chain = this.chain
      .then(() => this.w.write(data, position))
      .catch((e) => {
        this.err ??= e instanceof Error ? e : new Error(String(e));
      });
  };

  /** tunggu semua tulis tertunda selesai; lempar error tulis pertama bila ada */
  async flush(): Promise<void> {
    await this.chain;
    if (this.err) throw this.err;
  }
}

function clipVolume(clip: Clip, track: Track | undefined, local: number): number {
  const fi = clip.fadeIn > 0 ? clamp(local / clip.fadeIn, 0, 1) : 1;
  const fo = clip.fadeOut > 0 ? clamp((clip.duration - local) / clip.fadeOut, 0, 1) : 1;
  const vol = typeof clip.volume === "number" && isFinite(clip.volume) ? clip.volume : 1;
  return vol * (track?.muted ? 0 : 1) * Math.min(fi, fo);
}

/** posisi sumber untuk klip pada waktu timeline t — rumus SAMA dengan engine.syncMedia */
function srcTimeOf(clip: Clip, t: number): number {
  const local = t - clip.start;
  const srcSeg = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
  return clip.inPoint + ((local * clip.speed) % Math.max(0.033, srcSeg));
}

export interface FastExportOptions {
  start: number;
  end: number;
  /** status render mandiri pekerjaan ini (wajib untuk paralel; tanpa rs dipakai kondisi timeline global) */
  rs: RenderState;
  onProgress?: (p: number) => void;
  /** label tahap (untuk UI) */
  onStage?: (label: string) => void;
  fps?: number;
  /** v1.0.14: tulis file LANGSUNG ke folder ini (desktop) — tanpa blob di memori.
   * Nama TANPA ekstensi; ekstensi (.mp4/.webm) ditambahkan otomatis. */
  directSave?: { dir: string; name: string };
  /** v1.0.14: cache decode audio dari PEMANGGIL (dipakai ulang antar bagian split
   * satu film yang sama — tidak decode ulang berulang). Tidak dibuang otomatis. */
  audioCache?: AudioDecodeCache;
  /** v1.0.16: bitrate video (bps). Bawaan 9 Mbps (preset "Tajam"). */
  bitrate?: number;
}

export interface FastExportResult {
  blob: Blob;
  ext: ".mp4" | ".webm";
  mime: string;
  duration: number;
  /** v1.0.14: terisi bila file langsung ditulis ke disk (directSave) — blob kosong */
  savedPath?: string;
  /** v1.0.14: ukuran file hasil (byte) — dari penghitung tulis disk bila streaming */
  size?: number;
}

/** Campur & encode audio rentang timeline (PCM -> AudioEncoder).
 * v1.0.17: diekspor — mesin Turbo memakainya sebagai jalur audio
 * fallback bila stream-copy AAC tidak memenuhi syarat. */
export async function encodeAudioRange(
  muxer: Mp4Muxer<Mp4Target | Mp4StreamTarget> | WebmMuxer<WebmTarget | WebmStreamTarget>,
  audioCodec: string,
  opts: FastExportOptions,
  decodeCache: AudioDecodeCache,
  rs: RenderState,
  sampleRate = 48000
): Promise<void> {
  const { start, end } = opts;
  const dur = Math.max(0.05, end - start);

  // kumpulkan kontributor audio
  type Contributor =
    | { kind: "media"; clip: Clip; track: Track; src: AudioClipSrc }
    | { kind: "music"; clip: Clip; track: Track; src: AudioClipSrc };
  const contributors: Contributor[] = [];
  for (const clip of rs.clips) {
    if (clip.kind !== "video" && clip.kind !== "audio") continue;
    const track = rs.tracks.find((tr) => tr.id === clip.trackId);
    if (track?.hidden) continue;
    const asset = rs.assets.find((a) => a.id === clip.assetId);
    if (!asset) continue;
    if (asset.musicId) {
      const def = musicDefById(asset.musicId);
      if (!def) continue;
      try {
        const buf = await getMusicBuffer(def);
        contributors.push({ kind: "music", clip, track: track!, src: { mono: null, buffer: buf, sampleRate: buf.sampleRate } });
      } catch {
        /* musik gagal — lewati */
      }
    } else {
      const src = await decodeCache.get(asset.id, asset.url);
      if (src.mono || src.buffer) contributors.push({ kind: "media", clip, track: track!, src });
    }
  }
  // v1.0.14: referensi channel di-HOIST sekali di luar loop sampel — mixing
  // puluhan menit audio jadi jauh lebih cepat (getChannelData tak dipanggil per sampel)
  const mix = contributors.map((c) => {
    const b = c.src.buffer;
    const ch0 = c.src.mono ?? b!.getChannelData(0);
    const ch1 = c.src.mono ?? (b!.numberOfChannels > 1 ? b!.getChannelData(1) : b!.getChannelData(0));
    const sr = c.src.sampleRate;
    const bufDur = c.src.mono ? c.src.mono.length / Math.max(1, sr) : b?.duration ?? 0;
    return { clip: c.clip, track: c.track, kind: c.kind, ch0, ch1, sr, bufDur };
  });

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      muxer.addAudioChunk(chunk, meta as never);
    },
    error: () => {
      /* error audio tidak membatalkan video */
    },
  });
  encoder.configure({ codec: audioCodec, sampleRate, numberOfChannels: 2, bitrate: 192_000 });

  const win = 4096; // sampel per window
  const totalSamples = Math.ceil(dur * sampleRate);
  const l = new Float32Array(win);
  const r = new Float32Array(win);
  for (let off = 0; off < totalSamples; off += win) {
    const n = Math.min(win, totalSamples - off);
    l.fill(0);
    r.fill(0);
    for (let i = 0; i < n; i++) {
      const t = start + (off + i) / sampleRate;
      for (const m of mix) {
        const clip = m.clip;
        if (t < clip.start || t >= clip.start + clip.duration) continue;
        const local = t - clip.start;
        const v = clipVolume(clip, m.track, local);
        if (v <= 0) continue;
        let srcPos: number;
        if (m.kind === "media") {
          srcPos = srcTimeOf(clip, t);
        } else {
          srcPos = local % Math.max(0.016, m.bufDur);
        }
        const idx = srcPos * m.sr;
        const i0 = Math.floor(idx);
        const frac = idx - i0;
        const s0 = i0 >= 0 && i0 < m.ch0.length ? m.ch0[i0] : 0;
        const s0b = i0 + 1 < m.ch0.length ? m.ch0[i0 + 1] : s0;
        const s1 = i0 >= 0 && i0 < m.ch1.length ? m.ch1[i0] : 0;
        const s1b = i0 + 1 < m.ch1.length ? m.ch1[i0 + 1] : s1;
        l[i] += (s0 + (s0b - s0) * frac) * v;
        r[i] += (s1 + (s1b - s1) * frac) * v;
      }
    }
    // interleaved f32
    const data = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      data[i * 2] = clamp(l[i], -1, 1);
      data[i * 2 + 1] = clamp(r[i], -1, 1);
    }
    const ad = new AudioData({
      format: "f32",
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((off / sampleRate) * 1e6), // relatif ke awal stream
      data,
    });
    encoder.encode(ad);
    ad.close();
    if (encoder.encodeQueueSize > 24) await sleep(2);
  }
  await encoder.flush();
  encoder.close();
}

/** Pump decode satu klip video: putar cepat + catat mediaTime terakhir.
 * Laju adaptif: decode mendahului posisi target HANYA sedikit (0,1 dtk) —
 * gerakan di hasil tetap akurat, tidak ada ekor beku / lompatan frame. */
class VideoPump {
  mediaTime = -1;
  finished = false;
  private stopped = false;
  private el: HTMLVideoElement;
  private clip: Clip;
  private segLen: number;

  /** seberapa jauh decode boleh mendahului target (detik waktu sumber) */
  private static AHEAD_PAUSE = 0.1;
  /** batas koreksi paksa lewat seek (detik) — juga dipakai untuk putaran ulang klip */
  private static AHEAD_SEEK = 0.18;

  constructor(el: HTMLVideoElement, clip: Clip) {
    this.el = el;
    this.clip = clip;
    this.segLen = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
  }

  start() {
    const el = this.el;
    el.muted = true;
    el.volume = 0;
    this.pump();
  }

  /** laju decode menyesuaikan jarak ke target: makin tertinggal makin kencang.
   * Batas atas 5x menjaga akurasi gerak (keluaran vsync 60Hz: 5/60 = ±2 frame). */
  private setRate(target: number, cur: number) {
    const err = target - cur; // > 0 = decode tertinggal
    const want = clamp(this.clip.speed * (0.6 + err * 60), 0.25, 5);
    try {
      if (Math.abs((this.el.playbackRate || 1) - want) > 0.2) this.el.playbackRate = want;
    } catch {
      /* biarkan default */
    }
  }

  private pump = () => {
    if (this.stopped) return;
    const el = this.el;
    type RVFC = { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number };
    const rv = el as unknown as RVFC;
    if (typeof rv.requestVideoFrameCallback === "function") {
      rv.requestVideoFrameCallback!((_now, meta) => {
        this.mediaTime = meta.mediaTime;
        // ulang potongan bila klip loop melewati ujung segmen sumber
        const segEnd = this.clip.inPoint + this.segLen;
        if (this.clip.loopCount > 1 && meta.mediaTime > segEnd - 0.05) {
          try {
            el.currentTime = this.clip.inPoint;
          } catch {
            /* abaikan */
          }
        }
        if (el.ended) this.finished = true;
        this.pump();
      });
    } else {
      // fallback tanpa rVFC: kejar lewat currentTime
      const iv = setInterval(() => {
        if (this.stopped) {
          clearInterval(iv);
          return;
        }
        this.mediaTime = el.currentTime;
        if (el.ended) this.finished = true;
      }, 40);
    }
  };

  /** seek dan TUNGGU benar-benar selesai (frame siap digambar) — akurat di
   * lingkungan mana pun, termasuk tanpa compositor (headless/jendela latar) */
  private async seekTo(t: number): Promise<void> {
    const el = this.el;
    try {
      await new Promise<void>((resolve) => {
        let done = false;
        const fin = () => {
          if (done) return;
          done = true;
          el.removeEventListener("seeked", fin);
          resolve();
        };
        el.addEventListener("seeked", fin);
        try {
          el.currentTime = Math.max(this.clip.inPoint, Math.min(t, Math.max(0, (el.duration || 0) - 0.02)));
        } catch {
          fin();
        }
        setTimeout(fin, 2000);
      });
      this.mediaTime = el.currentTime;
    } catch {
      /* abaikan */
    }
  }

  /** tunggu seek yang sedang berjalan selesai */
  private async settle(): Promise<void> {
    const el = this.el;
    if (!el.seeking) return;
    await new Promise<void>((resolve) => {
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        el.removeEventListener("seeked", fin);
        resolve();
      };
      el.addEventListener("seeked", fin);
      setTimeout(fin, 2000);
    });
    this.mediaTime = el.currentTime;
  }

  /** tunggu sampai decode mencapai waktu sumber yang dibutuhkan (dengan batas waktu).
   * Progres diukur dari mediaTime rVFC ATAU currentTime elemen — keduanya valid,
   * supaya tetap jalan di lingkungan tanpa compositor (headless/latar belakang).
   * Laju decode ADAPTIF: bila sudah terlalu jauh MENDAHului target, dipelankan /
   * dijeda / di-seek ulang — gerakan hasil render tetap akurat & tidak ada ekor beku.
   * Selalu berakhir dengan elemen DIJEDA pada frame ≈ target agar composeFrame
   * menggambar frame yang TEPAT (decode tidak berjalan saat menggambar). */
  async waitFor(srcTime: number): Promise<void> {
    const segEnd = this.clip.inPoint + this.segLen;
    const target = Math.min(srcTime, segEnd - 0.02);
    const cur = () => Math.max(this.mediaTime, this.el.currentTime);
    if (this.finished) return;
    await this.settle();
    if (this.finished) return;
    // decode LARI TERLALU JAUH (jam media tidak terkendali / putaran ulang klip) -> koreksi seek
    if (cur() > target + VideoPump.AHEAD_SEEK) {
      try {
        this.el.pause();
      } catch {
        /* abaikan */
      }
      await this.seekTo(target);
      return; // sudah tepat di target & dijeda — frame siap digambar
    }
    const t0 = performance.now();
    while (!this.finished && !this.el.seeking && cur() < target - 0.015 && performance.now() - t0 < 1500) {
      if (this.el.paused) {
        this.setRate(target, cur());
        try {
          await this.el.play();
        } catch {
          /* coba lagi di putaran berikut */
        }
      } else {
        this.setRate(target, cur());
      }
      await sleep(4);
    }
    if (!this.finished && cur() < target - 0.015) {
      // decode macet -> dorong dengan seek langsung (jarang terjadi)
      await this.seekTo(target);
      return;
    }
    await this.settle();
    if (cur() > target + VideoPump.AHEAD_PAUSE) {
      // sedikit terlalu jauh -> jeda supaya tidak makin lari (murah, tanpa seek)
      try {
        this.el.pause();
      } catch {
        /* abaikan */
      }
    } else if (!this.el.paused) {
      // posisi pas: jeda agar frame yang digambar = frame target
      try {
        this.el.pause();
      } catch {
        /* abaikan */
      }
    }
  }

  stop() {
    this.stopped = true;
    try {
      this.el.pause();
      this.el.playbackRate = 1;
      this.el.muted = false;
    } catch {
      /* abaikan */
    }
  }
}

/** siapkan semua klip video aktif pada waktu t: elemen ada + di-seek ke posisi awal */
async function primeVideoAt(start: number, rs: RenderState): Promise<Map<string, VideoPump>> {
  const pumps = new Map<string, VideoPump>();
  for (const clip of rs.clips) {
    if (clip.kind !== "video") continue;
    if (start < clip.start || start >= clip.start + clip.duration) continue;
    const el = engine.elFor(clip, rs.assets);
    if (!(el instanceof HTMLVideoElement)) continue;
    // tunggu elemen benar-benar siap (metadata + frame pertama) — bila video
    // tidak bisa didekode (codec tidak didukung), beri pesan jelas, bukan video hitam
    const t0 = performance.now();
    while (el.readyState < 2 && !el.error && performance.now() - t0 < 10000) {
      await sleep(50);
    }
    if (el.error) throw new Error(`Video tidak dapat dibaca: ${rs.assets.find((a) => a.id === clip.assetId)?.name ?? "file"} (codec tidak didukung perangkat ini)`);
    if (el.readyState < 2) throw new Error("Video tidak selesai dimuat — coba lagi");
    const target = clamp(srcTimeOf(clip, start), 0, Math.max(0, (el.duration || 0) - 0.03));
    await new Promise<void>((resolve) => {
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        el.removeEventListener("seeked", fin);
        resolve();
      };
      el.addEventListener("seeked", fin);
      try {
        el.currentTime = target;
      } catch {
        fin();
      }
      setTimeout(fin, 1500);
    });
    const pump = new VideoPump(el, clip);
    pump.start();
    pumps.set(clip.id, pump);
  }
  return pumps;
}

/** ambil semua klip video yang aktif pada waktu t */
function activeVideoClips(t: number, rs: RenderState): Clip[] {
  return rs.clips.filter((c) => c.kind === "video" && c.start <= t && t < c.start + c.duration);
}

/** tunggu kanvas siap (elemen gambar lengkap) */
async function ensureImagesReady(t: number, rs: RenderState): Promise<void> {
  for (let round = 0; round < 24; round++) {
    let pending = false;
    for (const clip of rs.clips) {
      if (clip.kind !== "image") continue;
      if (t < clip.start || t >= clip.start + clip.duration) continue;
      const el = engine.elFor(clip, rs.assets);
      if (el instanceof HTMLImageElement && !el.complete) pending = true;
    }
    if (!pending) return;
    await sleep(50);
  }
}

/**
 * Render kilat satu rentang timeline -> Blob video (MP4/WebM).
 * Video TIDAK diputar di preview (offscreen) dan jauh lebih cepat dari realtime.
 */
export async function exportRangeFast(opts: FastExportOptions): Promise<FastExportResult> {
  const support = await fastSupported();
  if (!support) throw new Error("WebCodecs tidak tersedia");
  await ensureAppFonts();

  const rs = opts.rs;
  const w = rs.project.width;
  const h = rs.project.height;
  const fps = opts.fps ?? 30;
  const dur = Math.max(0.1, opts.end - opts.start);
  const totalFrames = Math.max(1, Math.ceil(dur * fps));

  opts.onStage?.("Menyiapkan mesin render kilat...");

  // ==== v1.0.14: tulis LANGSUNG ke disk (desktop) — file ratusan MB tak menumpuk di RAM ====
  let writer: DiskFileWriter | null = null;
  if (opts.directSave) {
    writer = await DiskFileWriter.begin(opts.directSave.dir, opts.directSave.name + support.ext);
  }

  // ==== muxer ====
  let muxer: Mp4Muxer<Mp4Target | Mp4StreamTarget> | WebmMuxer<WebmTarget | WebmStreamTarget>;
  let targetRef: Mp4Target | WebmTarget | null;
  let mime: string;
  /** v1.0.15: antrean tulis disk (null = jalur blob lama) — di-flush sebelum file ditutup */
  let diskFlush: DiskWriteChain | null = null;
  if (support.container === "mp4") {
    if (writer) {
      const flusher = new DiskWriteChain(writer);
      muxer = new Mp4Muxer({
        target: new Mp4StreamTarget({ onData: flusher.onData, chunked: true, chunkSize: DISK_CHUNK }),
        video: { codec: support.videoMuxCodec, width: w, height: h, frameRate: fps },
        ...(support.audioCodec ? { audio: { codec: support.audioCodec === "mp4a.40.2" ? ("aac" as const) : ("opus" as const), numberOfChannels: 2, sampleRate: 48000 } } : {}),
        fastStart: false,
      });
      diskFlush = flusher;
      targetRef = null;
    } else {
      const target = new Mp4Target();
      muxer = new Mp4Muxer({
        target,
        video: { codec: support.videoMuxCodec, width: w, height: h, frameRate: fps },
        ...(support.audioCodec ? { audio: { codec: support.audioCodec === "mp4a.40.2" ? ("aac" as const) : ("opus" as const), numberOfChannels: 2, sampleRate: 48000 } } : {}),
        fastStart: "in-memory",
      });
      targetRef = target;
    }
    mime = "video/mp4";
  } else {
    if (writer) {
      const flusher = new DiskWriteChain(writer);
      muxer = new WebmMuxer({
        target: new WebmStreamTarget({ onData: flusher.onData, chunked: true, chunkSize: DISK_CHUNK }),
        video: { codec: "V_VP9", width: w, height: h, frameRate: fps },
        ...(support.audioCodec ? { audio: { codec: "A_OPUS", numberOfChannels: 2, sampleRate: 48000 } } : {}),
      });
      diskFlush = flusher;
      targetRef = null;
    } else {
      const target = new WebmTarget();
      muxer = new WebmMuxer({
        target,
        video: { codec: "V_VP9", width: w, height: h, frameRate: fps },
        ...(support.audioCodec ? { audio: { codec: "A_OPUS", numberOfChannels: 2, sampleRate: 48000 } } : {}),
      });
      targetRef = target;
    }
    mime = "video/webm";
  }

  // ==== audio dulu (cepat, seluruh rentang) ====
  // v1.0.14: cache audio bisa dari PEMANGGIL — dipakai ulang antar bagian split
  // film yang sama (tidak decode ulang berulang = jauh lebih hemat waktu & RAM)
  const localCache = !opts.audioCache;
  const decodeCache = opts.audioCache ?? new AudioDecodeCache(new OfflineAudioContext(1, 1, 48000));
  if (support.audioCodec) {
    opts.onStage?.("Memproses audio...");
    await encodeAudioRange(muxer, support.audioCodec, opts, decodeCache, rs);
  }

  // ==== video: pompa decode + compose + encode ====
  opts.onStage?.("Merender video (mode kilat)...");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Kanvas offscreen gagal");

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta as never);
    },
    error: (e) => {
      console.error("VideoEncoder:", e);
    },
  });
  encoder.configure({
    codec: support.videoCodec,
    width: w,
    height: h,
    bitrate: opts.bitrate ?? 9_000_000,
    framerate: fps,
    ...(support.videoMuxCodec === "avc" ? { avc: { format: "avc" as const } } : {}),
  });

  // posisikan elemen & mulai pompa
  engine.pause();
  let pumps = await primeVideoAt(opts.start, rs);

  const gopSize = fps * 2;
  // v1.0.14: progres dikirim maksimal ~4x/detik (dulu SETIAP frame = 30x/detik
  // per video × pembaruan store → badai render ulang UI → aplikasi hang)
  let lastProgress = 0;
  const emitProgress = (p: number) => {
    const now = performance.now();
    if (p >= 1 || now - lastProgress >= 250) {
      lastProgress = now;
      opts.onProgress?.(p);
    }
  };
  for (let f = 0; f < totalFrames; f++) {
    const t = opts.start + f / fps;
    // bila klip video berganti di tengah rentang, pompa ulang untuk klip baru
    const actives = activeVideoClips(t, rs);
    const missing = actives.filter((c) => !pumps.has(c.id));
    if (missing.length) {
      for (const p of pumps.values()) p.stop();
      pumps = await primeVideoAt(t, rs);
    }
    // pastikan decode sudah mencapai posisi yang dibutuhkan (akurasi gerak)
    for (const clip of actives) {
      const pump = pumps.get(clip.id);
      if (pump) await pump.waitFor(srcTimeOf(clip, t));
    }
    if (f % (fps >> 1) === 0) await ensureImagesReady(t, rs);
    engine.composeFrame(ctx, t, true, rs);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((t - opts.start) * 1e6),
      duration: Math.round(1e6 / fps),
    });
    encoder.encode(frame, { keyFrame: f % gopSize === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 6) await sleep(2);
    emitProgress((f + 1) / totalFrames);
  }

  opts.onStage?.("Menyelesaikan berkas...");
  await encoder.flush();
  encoder.close();
  for (const p of pumps.values()) p.stop();
  if (localCache) decodeCache.dispose();
  muxer.finalize();
  // v1.0.14: bila menulis langsung ke disk, tutup file & kembalikan path
  // v1.0.15: flush antrean tulis DULU (pastikan semua potongan muxer benar-benar
  // sampai ke disk) sebelum menutup file; bila ada potongan gagal (mis. disk
  // penuh) -> abort agar tidak menyisakan file korup.
  let savedPath: string | undefined;
  if (writer) {
    try {
      await diskFlush?.flush();
      savedPath = await writer.finish();
    } catch (e) {
      await writer.abort();
      throw e;
    }
  }
  const blob = savedPath ? new Blob() : new Blob([(targetRef as Mp4Target).buffer], { type: mime });
  return { blob, ext: support.ext, mime, duration: dur, savedPath, size: savedPath ? writer?.bytes ?? 0 : blob.size };
}

/** estimasi dukungan cepat untuk UI (sinkron dari cache bila sudah di-probe) */
export async function fastSupportLabel(): Promise<string | null> {
  const s = await fastSupported();
  if (!s) return null;
  return s.container === "mp4" ? "MP4 (H.264) — mode kilat" : "WebM (VP9) — mode kilat";
}

/** durasi total timeline sekarang (helper kecil) */
export function currentTimelineDuration(): number {
  return totalDuration(useEditor.getState().clips);
}
