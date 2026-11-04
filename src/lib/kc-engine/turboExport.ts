// NOVACUT Studio - MESIN TURBO (v1.0.17) — WebCodecs MURNI, tanpa elemen <video>
//
// Bedanya dengan mesin kilat (fastExport.ts):
//  - DECODE: VideoDecoder WebCodecs murni + demuxer MP4 sendiri (mp4Demux.ts).
//    Tidak ada lagi pompa <video> yang dibatasi vsync compositor (5x) — decoder
//    berjalan secepat kemampuan hardware/software (umumnya 3-10x realtime),
//    RAM jauh lebih hemat, dan akurasi frame 100% (frame = timestamp sumber).
//  - AUDIO: STREAM-COPY AAC — sampel audio ter-encode disalin LANGSUNG ke muxer
//    tanpa decode/re-encode (kualitas asli, hampir tanpa RAM & tanpa waktu).
//    Bila setelan tidak netral (volume/speed/fade/musik), otomatis pakai jalur
//    PCM lama (encodeAudioRange) yang hasilnya sudah terbukti.
//  - PARALEL PER BAGIAN: fungsi ini merender SATU bagian; exporter.ts meletakkan
//    semua bagian dari seluruh batch ke satu antrean kerja global (#7).
//
// File sumber diakses ACAK via File.slice (aset menyimpan objek File) — film
// 2 jam berukuran beberapa GB TIDAK PERNAH dimuat utuh ke memori.

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target, StreamTarget as Mp4StreamTarget } from "mp4-muxer";
import { AudioDecodeCache, DISK_CHUNK, DiskWriteChain, encodeAudioRange, fastSupported } from "./fastExport";
import { engine, type ComposeWork, type RenderState } from "./engine";
import { ensureAppFonts } from "./fonts";
import { DiskFileWriter } from "./fsBridge";
import { headIsMp4, keyframeIndexAt, firstSampleAtOrAfter, parseMp4, type DemuxSample, type DemuxTrackInfo, type Mp4Info } from "./mp4Demux";
import type { Clip, MediaAsset } from "./types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** posisi sumber untuk klip pada waktu timeline t — rumus SAMA dengan engine */
function srcTimeOf(clip: Clip, t: number): number {
  const local = t - clip.start;
  const srcSeg = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
  return clip.inPoint + ((local * clip.speed) % Math.max(0.033, srcSeg));
}

// ===== cache parse MP4 per URL file (dipakai bersama semua bagian satu film) =====

const turboParse = new Map<string, Promise<{ info: Mp4Info; file: Blob }>>();

function loadMp4(asset: MediaAsset): Promise<{ info: Mp4Info; file: Blob }> {
  const key = asset.url;
  let p = turboParse.get(key);
  if (!p) {
    const file = asset.file!;
    p = parseMp4(file).then((info) => ({ info, file }));
    turboParse.set(key, p);
  }
  return p;
}

/** lepaskan cache parse satu film (panggil saat film selesai dirender) */
export function releaseTurboParse(url: string) {
  turboParse.delete(url);
}

export interface TurboCheck {
  ok: boolean;
  reason?: string;
}

/** Layakkah film ini dirender dengan mesin Turbo? (cek murah, hasil di-cache) */
export async function turboEligible(asset: MediaAsset): Promise<TurboCheck> {
  try {
    if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") {
      return { ok: false, reason: "WebCodecs decoder tidak tersedia" };
    }
    if (!asset.file) return { ok: false, reason: "berkas sumber tidak dapat diakses" };
    const head = new Uint8Array(await asset.file.slice(0, 16).arrayBuffer());
    if (!headIsMp4(head)) return { ok: false, reason: "bukan container MP4" };
    const { info } = await loadMp4(asset);
    const vtr = info.tracks.find((t) => t.kind === "video");
    if (!vtr || !vtr.videoMux || !vtr.description?.length) return { ok: false, reason: "codec video tidak didukung" };
    const sup = await VideoDecoder.isConfigSupported({ codec: vtr.codec, description: vtr.description as unknown as BufferSource });
    if (!sup.supported) return { ok: false, reason: `decoder ${vtr.codec} tidak tersedia` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "gagal membaca berkas" };
  }
}

/** Syarat stream-copy audio: setelan klip netral & tidak ada kontributor audio lain */
export function audioCopyAllowed(rs: RenderState, mainClip: Clip, mainAsset: MediaAsset): boolean {
  if (mainClip.speed !== 1 || mainClip.loopCount !== 1) return false;
  if (mainClip.volume !== 1 || mainClip.fadeIn > 0 || mainClip.fadeOut > 0) return false;
  if (mainAsset.musicId) return false;
  const vids = rs.clips.filter((c) => c.kind === "video");
  if (vids.length !== 1 || vids[0].id !== mainClip.id) return false;
  const vtr = rs.tracks.find((t) => t.id === mainClip.trackId);
  if (vtr?.muted) return false;
  for (const c of rs.clips) {
    if (c.kind === "audio") return false;
  }
  return true;
}

// ===== decoder WebCodecs murni =====

export interface TurboFrame {
  frame: VideoFrame;
  /** presentation time (detik sumber) */
  pts: number;
}

/** Baca + decode sampel video [startSrc, endSrc) — hasil urut presentasi (cts).
 * Frame sebelum startSrc ikut didecode (butuh sebagai referensi) lalu dibuang. */
async function* decodeVideoRange(
  file: Blob,
  tr: DemuxTrackInfo,
  startSrc: number,
  endSrc: number
): AsyncGenerator<TurboFrame> {
  const samples = tr.samples;
  const startUs = Math.round(startSrc * 1e6) - 2000;
  const endUs = Math.round(endSrc * 1e6) + 2000;
  const pending: VideoFrame[] = [];
  let err: Error | null = null;
  const dec = new VideoDecoder({
    output: (f) => pending.push(f),
    error: (e) => {
      err = e instanceof Error ? e : new Error(String(e));
    },
  });
  dec.configure({
    codec: tr.codec,
    description: tr.description as unknown as BufferSource,
    optimizeForLatency: false,
  });
  const cleanup = () => {
    try {
      if (dec.state !== "closed") dec.close();
    } catch {
      /* abaikan */
    }
    for (const f of pending) f.close();
    pending.length = 0;
  };
  try {
    let i = keyframeIndexAt(tr, startSrc);
    let eof = i >= samples.length;
    const BATCH_BYTES = 2 * 1024 * 1024;
    while (true) {
      if (err) throw err;
      // buang frame sebelum rentang (dependensi referensi saja)
      while (pending.length && pending[0].timestamp < startUs) pending.shift()!.close();
      if (pending.length && pending[0].timestamp >= endUs) break;
      if (pending.length) {
        const f = pending.shift()!;
        yield { frame: f, pts: f.timestamp / 1e6 };
        continue;
      }
      if (eof && dec.decodeQueueSize === 0) break;
      if (!eof && pending.length < 10 && dec.decodeQueueSize < 14) {
        // kumpulkan satu batch sampel (~2 MB) lalu baca sekali slice
        let bytes = 0;
        const batch: DemuxSample[] = [];
        while (i < samples.length && bytes < BATCH_BYTES && batch.length < 512) {
          batch.push(samples[i]);
          bytes += samples[i].size;
          i++;
        }
        if (!batch.length) {
          eof = true;
        } else {
          const from = batch[0].offset;
          const last = batch[batch.length - 1];
          const buf = new Uint8Array(await file.slice(from, last.offset + last.size).arrayBuffer());
          for (const s of batch) {
            const data = buf.slice(s.offset - from, s.offset - from + s.size);
            dec.decode(
              new EncodedVideoChunk({
                type: s.sync ? "key" : "delta",
                timestamp: Math.round(s.cts * 1e6),
                data,
              })
            );
          }
          if (i >= samples.length) eof = true;
        }
      } else {
        await sleep(2);
      }
    }
  } catch (e) {
    cleanup();
    throw e;
  }
  // selesai normal — drain sisa (frame terakhir) lalu tutup
  while (pending.length) {
    const f = pending.shift()!;
    if (f.timestamp < endUs) yield { frame: f, pts: f.timestamp / 1e6 };
    else f.close();
  }
  cleanup();
}

// ===== audio: stream-copy AAC =====

/** Salin sampel AAC sumber [srcStart, srcEnd) ke muxer dengan timestamp baru
 * (periode cover diganti sunyi). Kualitas 100% asli, tanpa decode. */
async function copyAudioRange(
  muxer: Mp4Muxer<Mp4Target | Mp4StreamTarget>,
  file: Blob,
  atr: DemuxTrackInfo,
  srcStart: number,
  srcEnd: number,
  shiftSec: number
): Promise<void> {
  const samples = atr.samples;
  if (!samples.length) return;
  let i0 = firstSampleAtOrAfter(atr, srcStart);
  // chunk yang melintasi titik potong tetap diikutkan (rebased) — selisih < 22 ms
  if (i0 > 0 && samples[i0 - 1].cts < srcStart) {
    const avg = Math.max(0.001, (samples[samples.length - 1].cts - samples[0].cts) / samples.length);
    if (samples[i0 - 1].cts + avg > srcStart) i0--;
  }
  // durasi rata-rata sampel (fallback chunk terakhir — AAC = 1024 sampel/frame)
  const avgDur = Math.max(0.001, 1024 / Math.max(8000, atr.sampleRate || 48000));
  let metaSent = false;
  const BATCH = 4 * 1024 * 1024;
  let i = i0;
  while (i < samples.length && samples[i].cts < srcEnd) {
    // satu batch baca (sampel AAC umumnya berurutan di mdat)
    const batch: DemuxSample[] = [];
    let bytes = 0;
    let j = i;
    while (j < samples.length && bytes < BATCH && samples[j].cts < srcEnd) {
      batch.push(samples[j]);
      bytes += samples[j].size;
      j++;
    }
    const from = batch[0].offset;
    const last = batch[batch.length - 1];
    const buf = new Uint8Array(await file.slice(from, last.offset + last.size).arrayBuffer());
    for (let k = 0; k < batch.length; k++) {
      const s = batch[k];
      if (s.cts >= srcEnd) break;
      const data = buf.slice(s.offset - from, s.offset - from + s.size);
      const ts = Math.round((shiftSec + Math.max(0, s.cts - srcStart)) * 1e6);
      // mp4-muxer WAJIB duration — hitung dari sampel berikutnya (dts audio monoton)
      const nxtCts = k + 1 < batch.length ? batch[k + 1].dts : j < samples.length ? samples[j].dts : s.dts + avgDur;
      const durUs = Math.max(1, Math.round((nxtCts - s.dts) * 1e6));
      const chunk = new EncodedAudioChunk({ type: "key", timestamp: ts, duration: durUs, data });
      muxer.addAudioChunk(
        chunk,
        metaSent
          ? undefined
          : ({
              decoderConfig: {
                codec: "mp4a.40.2",
                sampleRate: atr.sampleRate,
                numberOfChannels: clamp(atr.channels || 2, 1, 8),
                description: atr.description,
              },
            } as never)
      );
      metaSent = true;
    }
    i = j;
  }
}

/** Encode sunyi (hasil AudioEncoder AAC) utk periode cover [0, shift) */
async function encodeSilence(muxer: Mp4Muxer<Mp4Target | Mp4StreamTarget>, sec: number): Promise<void> {
  if (sec <= 0.01) return;
  const enc = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta as never),
    error: () => {
      /* sunyi — tak ada error berarti */
    },
  });
  enc.configure({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 128_000 });
  const win = 4096;
  const total = Math.ceil(sec * 48000);
  const data = new Float32Array(win * 2); // nol
  for (let off = 0; off < total; off += win) {
    const n = Math.min(win, total - off);
    const ad = new AudioData({
      format: "f32",
      sampleRate: 48000,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((off / 48000) * 1e6),
      data: data.subarray(0, n * 2) as unknown as BufferSource,
    });
    enc.encode(ad);
    ad.close();
    if (enc.encodeQueueSize > 32) await sleep(2);
  }
  await enc.flush();
  enc.close();
}

// ===== render SATU bagian =====

export interface TurboSegmentOptions {
  rs: RenderState;
  /** klip video utama (satu-satunya klip video di rs) */
  clip: Clip;
  asset: MediaAsset;
  /** rentang TIMELINE konten (tanpa cover) */
  start: number;
  end: number;
  /** durasi cover di depan (detik) */
  shift: number;
  bitrate: number;
  fps?: number;
  directSave?: { dir: string; name: string };
  audioCache?: AudioDecodeCache;
  onProgress?: (p: number) => void;
  onStage?: (label: string) => void;
  /** v1.0.17: label tahap audio (utk UI) */
  audioCopy?: boolean;
}

export interface TurboSegmentResult {
  /** blob kosong bila directSave (file sudah di disk) */
  blob: Blob;
  ext: ".mp4";
  mime: string;
  duration: number;
  savedPath?: string;
  size?: number;
}

/** Render satu bagian (rentang timeline) dengan mesin Turbo — MP4 saja. */
export async function exportSegmentTurbo(opts: TurboSegmentOptions): Promise<TurboSegmentResult> {
  const support = await fastSupported();
  if (!support || support.container !== "mp4") throw new Error("Mesin Turbo memerlukan encoder MP4 (H.264)");
  await ensureAppFonts();

  const { rs, clip, asset } = opts;
  const w = rs.project.width;
  const h = rs.project.height;
  const fps = opts.fps ?? 30;
  const contentDur = Math.max(0.1, opts.end - opts.start);
  const totalDur = opts.shift + contentDur;
  const totalFrames = Math.max(1, Math.ceil(totalDur * fps));
  const gopSize = fps * 2;

  const { info, file } = await loadMp4(asset);
  const vtr = info.tracks.find((t) => t.kind === "video" && t.videoMux);
  if (!vtr) throw new Error("Track video MP4 tidak ditemukan");
  const atr = info.tracks.find((t) => t.kind === "audio" && t.codec === "mp4a.40.2" && t.description?.length);

  opts.onStage?.("Menyiapkan mesin Turbo...");

  // ==== tulis langsung ke disk (desktop) ====
  let writer: DiskFileWriter | null = null;
  if (opts.directSave) {
    writer = await DiskFileWriter.begin(opts.directSave.dir, opts.directSave.name + ".mp4");
  }

  // ==== muxer (MP4) ====
  const useCopy = !!opts.audioCopy && !!atr;
  let muxer: Mp4Muxer<Mp4Target | Mp4StreamTarget>;
  let targetRef: Mp4Target | null = null;
  let diskFlush: { onData: (data: Uint8Array, position: number) => void; flush: () => Promise<void> } | null = null;
  const audioMux = useCopy && atr
    ? { codec: "aac" as const, numberOfChannels: clamp(atr.channels || 2, 1, 8), sampleRate: atr.sampleRate }
    : support.audioCodec
      ? { codec: (support.audioCodec === "mp4a.40.2" ? "aac" : "opus") as "aac" | "opus", numberOfChannels: 2, sampleRate: 48000 }
      : null;
  if (writer) {
    const flusher = new DiskWriteChain(writer);
    muxer = new Mp4Muxer({
      target: new Mp4StreamTarget({ onData: flusher.onData, chunked: true, chunkSize: DISK_CHUNK }),
      video: { codec: support.videoMuxCodec, width: w, height: h, frameRate: fps },
      ...(audioMux ? { audio: audioMux } : {}),
      fastStart: false,
      // bila encoder AAC sunyi tak tersedia (fallback platform), chunk audio
      // pertama mulai di detik ke-"shift" — offset otomatis ke 0 oleh muxer
      firstTimestampBehavior: "offset",
    });
    diskFlush = flusher;
  } else {
    targetRef = new Mp4Target();
    muxer = new Mp4Muxer({
      target: targetRef,
      video: { codec: support.videoMuxCodec, width: w, height: h, frameRate: fps },
      ...(audioMux ? { audio: audioMux } : {}),
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
  }

  // ==== audio ====
  if (useCopy && atr) {
    opts.onStage?.("Menyalin audio asli (stream-copy)...");
    if (opts.shift > 0) {
      // sunyi pembuka (periode cover) — bila platform tak punya encoder AAC,
      // lewati saja: audio konten tetap tersalin mulai detik ke-shift
      try {
        await encodeSilence(muxer, opts.shift);
      } catch (e) {
        console.warn("Sunyi cover gagal di-encode — dilewati:", e);
      }
    }
    const srcStart = srcTimeOf(clip, clip.start);
    // akhir rentang TANPA wrap modulo (lihat catatan di blok video di bawah)
    const segLenA = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
    const srcEnd = clip.inPoint + clamp(clip.duration * clip.speed, 0, segLenA);
    await copyAudioRange(muxer, file, atr, srcStart, srcEnd, opts.shift);
  } else if (support.audioCodec && audioMux) {
    opts.onStage?.("Memproses audio...");
    const cache = opts.audioCache ?? new AudioDecodeCache(new OfflineAudioContext(1, 1, 48000));
    await encodeAudioRange(
      muxer,
      support.audioCodec,
      { start: 0, end: totalDur, rs, bitrate: opts.bitrate },
      cache,
      rs
    );
  }

  // ==== video: decode murni + compose + encode ====
  opts.onStage?.("Merender video (mesin Turbo)...");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Kanvas offscreen gagal");
  const work: ComposeWork = {
    videoFrames: new Map<string, VideoFrame | null>(),
    tmpA: document.createElement("canvas"),
    tmpB: document.createElement("canvas"),
    scratch: document.createElement("canvas"),
  };

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta as never),
    error: (e) => console.error("Turbo VideoEncoder:", e),
  });
  encoder.configure({
    codec: support.videoCodec,
    width: w,
    height: h,
    bitrate: opts.bitrate,
    framerate: fps,
    ...(support.videoMuxCodec === "avc" ? { avc: { format: "avc" as const } } : {}),
  });

  // rentang sumber yang perlu didekode — TANPA modulo: di titik akhir klip
  // srcTimeOf membungkus ke 0 (perilaku loop) → rentang jadi kosong/terbalik.
  // Turbo hanya berjalan utk loopCount=1, jadi petakan langsung + kunci ke segmen.
  const segLen = (clip.duration * clip.speed) / Math.max(1, clip.loopCount);
  const tEnd = Math.min(clip.start + clip.duration, opts.shift + contentDur + 0.02);
  const srcStart = srcTimeOf(clip, Math.max(clip.start, opts.shift));
  const srcEnd = clip.inPoint + clamp(Math.max(0, tEnd - clip.start) * clip.speed, 0, segLen);

  const gen = decodeVideoRange(file, vtr, srcStart, srcEnd);
  const buf: TurboFrame[] = [];
  let streamDone = false;
  let pullErr: unknown = null; // error decoder ditampung, dilempar serempak di loop render
  const pull = async (): Promise<boolean> => {
    if (streamDone) return false;
    let r: IteratorResult<TurboFrame>;
    try {
      r = await gen.next();
    } catch (e) {
      pullErr = e; // jangan biarkan rejection lewat tanpa ditangani (void pull)
      streamDone = true;
      return false;
    }
    if (r.done) {
      streamDone = true;
      return false;
    }
    buf.push(r.value);
    return true;
  };
  const fillBuf = async (n: number) => {
    while (!streamDone && buf.length < n) {
      const got = await pull();
      if (!got) break;
    }
  };
  await fillBuf(4); // mulai decode sejak sekarang (keyframe + beberapa frame)

  let lastProgress = 0;
  const emit = (p: number) => {
    const now = performance.now();
    if (p >= 1 || now - lastProgress >= 250) {
      lastProgress = now;
      opts.onProgress?.(p);
    }
  };

  try {
    for (let f = 0; f < totalFrames; f++) {
      if (pullErr) throw pullErr; // decode gagal → gagal bersih → fallback mesin kilat
      const t = f / fps;
      let frame: VideoFrame | null = null;
      if (t >= clip.start - 1e-4 && t < clip.start + clip.duration) {
        const srcT = srcTimeOf(clip, t);
        // majukan buffer: buang frame yang waktunya sudah lewat
        while (buf.length >= 2 && buf[1].pts <= srcT + 0.002) {
          buf.shift()!.frame.close();
        }
        while (buf.length < 2 && !streamDone) {
          const got = await pull();
          if (!got) break;
          while (buf.length >= 2 && buf[1].pts <= srcT + 0.002) buf.shift()!.frame.close();
        }
        const head = buf[0];
        if (head && head.pts <= srcT + 0.05) frame = head.frame;
        // isi ulang buffer di belakang (decode tetap berjalan mendahului)
        if (buf.length < 6 && !streamDone) void pull();
      }
      work.videoFrames!.set(clip.assetId ?? clip.id, frame);
      engine.composeFrame(ctx, t, true, rs, work);
      work.videoFrames!.set(clip.assetId ?? clip.id, null);
      const out = new VideoFrame(canvas, {
        timestamp: Math.round(t * 1e6),
        duration: Math.round(1e6 / fps),
      });
      encoder.encode(out, { keyFrame: f % gopSize === 0 });
      out.close();
      // frame TIDAK ditutup di sini — bisa dipakai beberapa iterasi (hold frame)
      // (fps render > fps sumber, mis. 30 > 24) — ditutup saat dibuang dari buffer
      while (encoder.encodeQueueSize > 6) await sleep(2);
      if (buf.length < 4 && !streamDone) await pull();
      emit((f + 1) / totalFrames);
    }
  } finally {
    await gen.return(undefined as never).catch(() => undefined); // tutup decoder + sisa frame
    for (const b of buf) b.frame.close(); // sisa buffer tidak boleh bocor
    buf.length = 0;
  }

  opts.onStage?.("Menyelesaikan berkas...");
  await encoder.flush();
  encoder.close();
  muxer.finalize();

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
  const blob = savedPath ? new Blob() : new Blob([targetRef!.buffer], { type: "video/mp4" });
  return { blob, ext: ".mp4", mime: "video/mp4", duration: totalDur, savedPath, size: savedPath ? writer?.bytes ?? 0 : blob.size };
}
