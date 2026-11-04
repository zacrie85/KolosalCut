// NOVACUT Studio - DEMUXER MP4 MURNI (v1.0.17 - Mesin Turbo)
//
// Parser MP4 ringan tanpa dependensi untuk mesin render Turbo (WebCodecs murni):
//  - membaca struktur box (ftyp/moov/mdat) dengan akses ACAK via File.slice —
//    file film 2 jam (ratusan MB s/d beberapa GB) TIDAK PERNAH dimuat utuh ke RAM
//  - mengekstrak tabel sampel (stts/ctts/stsc/stsz/stco/stss) + catatan codec
//    (avcC/hvcC/vpcc/av1C/esds) agar VideoDecoder/AudioEncoder bisa dikonfigurasi
//  - tidak men-decode apa pun — tugasnya menyediakan "bahan mentah" terurut
//
// Track yang tidak didukung decoder dilewati; pemanggil memakai jalur lama.

export interface DemuxSample {
  /** offset byte absolut di file */
  offset: number;
  size: number;
  /** decode time (detik sumber) */
  dts: number;
  /** composition/presentation time (detik sumber) */
  cts: number;
  sync: boolean;
}

export type TurboVideoMux = "avc" | "hevc" | "vp9" | "av1";

export interface DemuxTrackInfo {
  id: number;
  kind: "video" | "audio";
  /** codec string gaya WebCodecs, mis. "avc1.640028" / "mp4a.40.2" */
  codec: string;
  /** codec video utk muxer mp4-muxer; undefined = tidak didukung */
  videoMux?: TurboVideoMux;
  /** avcC / hvcC / vpcc / av1C / AudioSpecificConfig (tanpa header box) */
  description?: Uint8Array;
  width: number;
  height: number;
  channels: number;
  sampleRate: number;
  timescale: number;
  /** durasi detik (dari mdhd) */
  duration: number;
  /** fps kasar (sampel / durasi) — video saja */
  fps: number;
  samples: DemuxSample[];
}

export interface Mp4Info {
  tracks: DemuxTrackInfo[];
  size: number;
}

/** true bila 12 byte pertama file adalah container MP4 (box "ftyp") */
export function headIsMp4(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  return head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70; // "ftyp"
}

/** true bila file adalah WebM/Matroska (magic EBML) */
export function headIsWebm(head: Uint8Array): boolean {
  return head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
}

// ===== util baca =====

async function readBytes(blob: Blob, off: number, len: number): Promise<Uint8Array> {
  const end = Math.min(blob.size, off + len);
  if (off >= end) return new Uint8Array(0);
  const buf = await blob.slice(off, end).arrayBuffer();
  return new Uint8Array(buf);
}

const hex2 = (v: number): string => v.toString(16).toUpperCase().padStart(2, "0");

function fourCC(dv: DataView, o: number): string {
  return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
}

interface Box {
  type: string;
  /** offset box START (termasuk header) */
  start: number;
  /** offset BODY (setelah header) */
  body: number;
  /** panjang BODY */
  bodyLen: number;
}

/** daftar box anak langsung dalam rentang [from, to) — box berurutan standar */
function children(dv: DataView, from: number, to: number): Box[] {
  const out: Box[] = [];
  let o = from;
  while (o + 8 <= to) {
    let size = dv.getUint32(o);
    const type = fourCC(dv, o + 4);
    let hdr = 8;
    if (size === 1) {
      if (o + 16 > to) break;
      size = dv.getUint32(o + 8) * 4294967296 + dv.getUint32(o + 12);
      hdr = 16;
    } else if (size === 0) {
      size = to - o; // sampai akhir kontainer
    }
    if (size < hdr || o + size > to + 1) break; // korup — berhenti
    out.push({ type, start: o, body: o + hdr, bodyLen: size - hdr });
    o += size;
  }
  return out;
}

/** panjang "expandable" gaya descriptor MPEG-4 (bit 0x80 = lanjut) */
function descLen(dv: DataView, o: number): { len: number; next: number } {
  let len = 0;
  let p = o;
  for (let i = 0; i < 4; i++) {
    const b = dv.getUint8(p++);
    len = (len << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return { len, next: p };
}

/** parsi esds STRUKTURAL (ISO 14496-1): ES_Descriptor → DecoderConfig → DSI.
 * Mengembalikan { objectTypeIndication, AudioSpecificConfig }. */
function parseEsds(dv: DataView, body: number, len: number): { oti: number | null; asc: Uint8Array | null } {
  const to = body + len;
  let oti: number | null = null;
  let asc: Uint8Array | null = null;
  // ES_Descriptor pada body+4 (setelah version/flags)
  let o = body + 4;
  if (o >= to || dv.getUint8(o) !== 0x03) return { oti, asc };
  const es = descLen(dv, o + 1);
  const esEnd = Math.min(to, es.next + es.len);
  let p = es.next;
  if (p + 3 > esEnd) return { oti, asc };
  p += 2; // ES_ID
  const flags = dv.getUint8(p);
  p += 1;
  if (flags & 0x80) p += 2; // dependsOn_ES_ID
  if (flags & 0x40) p += 2; // OCR_ES_ID
  // DecoderConfigDescriptor (tag 0x04)
  if (p < esEnd && dv.getUint8(p) === 0x04) {
    const dcd = descLen(dv, p + 1);
    const dcdBody = dcd.next;
    const dcdEnd = Math.min(esEnd, dcdBody + dcd.len);
    if (dcdEnd - dcdBody >= 1) oti = dv.getUint8(dcdBody);
    // DecoderSpecificInfo (tag 0x05) — setelah 13 byte tetap DCD
    let q = dcdBody + 13;
    while (q + 2 <= dcdEnd) {
      const tag = dv.getUint8(q);
      const d = descLen(dv, q + 1);
      if (tag === 0x05) {
        asc = new Uint8Array(dv.buffer.slice(dv.byteOffset + d.next, dv.byteOffset + d.next + d.len));
        break;
      }
      q = d.next + d.len;
    }
  }
  return { oti, asc };
}
/** codec string video dari catatan codec (avcC/hvcC/vpcC/av1C) */
function videoCodecString(mux: TurboVideoMux, desc: Uint8Array): string {
  const dv = new DataView(desc.buffer, desc.byteOffset, desc.byteLength);
  switch (mux) {
    case "avc":
      if (desc.length < 4) return "avc1.42E01E";
      return `avc1.${hex2(desc[1])}${hex2(desc[2])}${hex2(desc[3])}`;
    case "hevc": {
      if (desc.length < 13) return "hvc1.1.6.L93.B0";
      const b1 = dv.getUint8(1);
      const space = (b1 >> 6) & 3;
      const pidc = b1 & 31;
      const compat = dv.getUint32(2).toString(16).toUpperCase();
      let cons = "";
      for (let i = 6; i < 12; i++) cons += hex2(desc[i]);
      const level = dv.getUint8(12);
      return `hvc1.${space || 1}.${pidc}.${compat}.${level >= 128 ? "H" : "L"}${level & 127}.${cons}`;
    }
    case "vp9": {
      const prof = desc.length > 0 ? desc[0] : 0;
      const lvl = desc.length > 1 ? desc[1] : 10;
      const depth = desc.length > 2 ? desc[2] : 8;
      return `vp09.${hex2(prof)}.${hex2(lvl)}.${hex2(depth)}`;
    }
    case "av1": {
      if (desc.length < 4) return "av01.0.08M.08";
      const b1 = dv.getUint8(1);
      const prof = (b1 >> 5) & 7;
      const lvl = b1 & 31;
      const b2 = dv.getUint8(2);
      const tier = (b2 >> 7) & 1;
      const depth = (b2 & 0x40 ? (b2 & 0x20 ? 12 : 10) : 8);
      // format resmi WebCodecs: av01.<profile>.<level 2 digit><tier>.<bitdepth>
      // (level DULU, baru huruf tier — terbalik = string ditolak Chromium → Turbo mati)
      return `av01.${prof}.${hex2(lvl)}${tier ? "H" : "M"}.${hex2(depth)}`;
    }
  }
}

interface EntryMeta {
  codec: string;
  videoMux?: TurboVideoMux;
  description?: Uint8Array;
  width: number;
  height: number;
  channels: number;
  sampleRate: number;
}

/** parsi SATU sample entry (avc1/mp4a/...) → codec + description */
function parseSampleEntry(
  dv: DataView,
  eStart: number,
  eSize: number,
  kind: "video" | "audio"
): EntryMeta {
  const meta: EntryMeta = { codec: "", width: 0, height: 0, channels: 0, sampleRate: 0 };
  // ukuran header tetap sebelum box anak (termasuk header box 8 byte):
  // video 78 byte isi + 8 header = 86; audio 28 isi + 8 header = 36
  const childFrom = eStart + (kind === "video" ? 86 : 36);
  if (kind === "video") {
    meta.width = dv.getUint16(eStart + 32); // width @ +32 dari entry
    meta.height = dv.getUint16(eStart + 34);
  } else {
    meta.channels = dv.getUint16(eStart + 24) || 2;
    meta.sampleRate = Math.round(dv.getUint32(eStart + 32) / 65536) || 48000;
  }
  const kids = children(dv, childFrom, eStart + eSize);
  for (const k of kids) {
    if (k.type === "avcC" || k.type === "hvcC" || k.type === "vpcC" || k.type === "av1C") {
      meta.description = new Uint8Array(dv.buffer.slice(dv.byteOffset + k.body, dv.byteOffset + k.body + k.bodyLen));
      meta.videoMux = k.type === "avcC" ? "avc" : k.type === "hvcC" ? "hevc" : k.type === "vpcC" ? "vp9" : "av1";
      meta.codec = videoCodecString(meta.videoMux, meta.description);
    } else if (k.type === "esds") {
      const { oti, asc } = parseEsds(dv, k.body, k.bodyLen);
      meta.description = asc ?? undefined;
      // 0x40 = AAC (semua varian); 0x66/0x67/0x68 = AAC lama
      meta.codec = oti !== null && (oti === 0x40 || oti === 0x66 || oti === 0x67 || oti === 0x68) ? "mp4a.40.2" : "";
    }
  }
  if (!meta.codec) meta.codec = fourCC(dv, eStart + 4); // fallback nama fourcc
  return meta;
}

/**
 * Parse MP4 dari Blob/File — akses acak via slice, RAM minim.
 * Mengembalikan semua track video/audio yang tabel sampelnya valid.
 */
export async function parseMp4(blob: Blob): Promise<Mp4Info> {
  // ---- 1. pindai box level atas, temukan moov ----
  let moov: { body: number; bodyLen: number } | null = null;
  let off = 0;
  const size = blob.size;
  while (off + 8 <= size) {
    const head = await readBytes(blob, off, 16);
    if (head.length < 8) break;
    const hv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let sz = hv.getUint32(0);
    const type = fourCC(hv, 4);
    let hdr = 8;
    if (sz === 1) {
      if (head.length < 16) break;
      sz = hv.getUint32(8) * 4294967296 + hv.getUint32(12);
      hdr = 16;
    } else if (sz === 0) {
      sz = size - off;
    }
    if (sz < hdr) break;
    if (type === "moov") {
      moov = { body: off + hdr, bodyLen: Math.min(sz - hdr, size - off - hdr) };
      break;
    }
    off += sz;
  }
  if (!moov) throw new Error("moov tidak ditemukan — bukan MP4 valid");

  // ---- 2. baca utuh moov (biasanya < 20 MB) & parsi ----
  const moovBuf = await blob.slice(moov.body, moov.body + moov.bodyLen).arrayBuffer();
  const mv = new DataView(moovBuf);
  const mvBoxes = children(mv, 0, moovBuf.byteLength);
  const tracks: DemuxTrackInfo[] = [];

  for (const trak of mvBoxes.filter((b) => b.type === "trak")) {
    try {
      const kids = children(mv, trak.body, trak.body + trak.bodyLen);
      const mdia = kids.find((b) => b.type === "mdia");
      if (!mdia) continue;
      const mdiaKids = children(mv, mdia.body, mdia.body + mdia.bodyLen);
      const mdhd = mdiaKids.find((b) => b.type === "mdhd");
      const hdlr = mdiaKids.find((b) => b.type === "hdlr");
      const minf = mdiaKids.find((b) => b.type === "minf");
      if (!mdhd || !hdlr || !minf) continue;
      const handler = fourCC(mv, hdlr.body + 8);
      if (handler !== "vide" && handler !== "soun") continue;
      const kind: "video" | "audio" = handler === "vide" ? "video" : "audio";
      const v1 = mv.getUint8(mdhd.body) === 1;
      const timescale = mv.getUint32(mdhd.body + (v1 ? 20 : 12));
      const durRaw = v1 ? Number(mv.getBigUint64(mdhd.body + 24)) : mv.getUint32(mdhd.body + 16);
      if (!timescale) continue;
      const duration = durRaw / timescale;

      const stbl = children(mv, minf.body, minf.body + minf.bodyLen).find((b) => b.type === "stbl");
      if (!stbl) continue;
      const sb = children(mv, stbl.body, stbl.body + stbl.bodyLen);
      const stsd = sb.find((b) => b.type === "stsd");
      const stts = sb.find((b) => b.type === "stts");
      const stsc = sb.find((b) => b.type === "stsc");
      const stsz = sb.find((b) => b.type === "stsz");
      const stco = sb.find((b) => b.type === "stco");
      const co64 = sb.find((b) => b.type === "co64");
      const stss = sb.find((b) => b.type === "stss");
      if (!stsd || !stts || !stsc || !stsz || (!stco && !co64)) continue;

      // ---- sample entry pertama ----
      const entryCount = mv.getUint32(stsd.body + 4);
      if (entryCount < 1) continue;
      const firstEntry = stsd.body + 8;
      const eSize = mv.getUint32(firstEntry);
      const eType = fourCC(mv, firstEntry + 4);
      if (kind === "video" && !["avc1", "avc2", "avc3", "avc4", "hvc1", "hev1", "vp09", "av01"].includes(eType)) continue;
      if (kind === "audio" && eType !== "mp4a") continue;
      const em = parseSampleEntry(mv, firstEntry, Math.min(eSize, stsd.body + stsd.bodyLen - firstEntry), kind);
      if (kind === "video" && !em.videoMux) continue; // catatan codec wajib utk decode

      // ---- stts → dts kumulatif ----
      const nStts = mv.getUint32(stts.body + 4);
      let dtsList = new Float64Array(1 << 16);
      let nSamples = 0;
      let dts = 0;
      for (let i = 0; i < nStts; i++) {
        const p = stts.body + 8 + i * 8;
        const count = mv.getUint32(p);
        const delta = mv.getUint32(p + 4);
        for (let c = 0; c < count; c++) {
          if (nSamples === dtsList.length) {
            const bigger = new Float64Array(dtsList.length * 2);
            bigger.set(dtsList);
            dtsList = bigger;
          }
          dtsList[nSamples++] = dts;
          dts += delta;
        }
      }
      if (!nSamples) continue;

      // ---- ctts → cts (versi 1 = offset signed) ----
      const ctsList = new Float64Array(nSamples);
      ctsList.set(dtsList.subarray(0, nSamples));
      const ctts = sb.find((b) => b.type === "ctts");
      if (ctts) {
        const nCtts = mv.getUint32(ctts.body + 4);
        let idx = 0;
        for (let i = 0; i < nCtts && idx < nSamples; i++) {
          const p = ctts.body + 8 + i * 8;
          const count = mv.getUint32(p);
          const offRaw = mv.getInt32(p + 4);
          for (let c = 0; c < count && idx < nSamples; c++, idx++) ctsList[idx] = dtsList[idx] + offRaw;
        }
      }

      // ---- stss → keyframe (tanpa stss = semua sync) ----
      const sync = new Uint8Array(nSamples).fill(1);
      if (stss) {
        sync.fill(0);
        const nSync = mv.getUint32(stss.body + 4);
        for (let i = 0; i < nSync; i++) {
          const s = mv.getUint32(stss.body + 8 + i * 4);
          if (s >= 1 && s <= nSamples) sync[s - 1] = 1;
        }
      }

      // ---- stsz (ukuran per sampel / seragam) ----
      const uniformSize = mv.getUint32(stsz.body + 4);
      const sampleSize = (i: number): number => (uniformSize ? uniformSize : mv.getUint32(stsz.body + 12 + i * 4));

      // ---- stsc + stco/co64 → offset per sampel ----
      const nChunk = stco ? mv.getUint32(stco.body + 4) : mv.getUint32(co64!.body + 4);
      const chunkOff = (ci: number): number =>
        stco ? mv.getUint32(stco.body + 8 + ci * 4) : Number(mv.getBigUint64(co64!.body + 8 + ci * 8));
      const nStsc = mv.getUint32(stsc.body + 4);
      const samples: DemuxSample[] = [];
      const ts = timescale;
      for (let run = 0; run < nStsc; run++) {
        const p = stsc.body + 8 + run * 12;
        const firstChunk = mv.getUint32(p);
        const spc = mv.getUint32(p + 4);
        const lastChunk = run + 1 < nStsc ? mv.getUint32(stsc.body + 8 + (run + 1) * 12) - 1 : nChunk;
        for (let ch = firstChunk; ch <= lastChunk && ch <= nChunk; ch++) {
          let o = chunkOff(ch - 1);
          for (let s = 0; s < spc && samples.length < nSamples; s++) {
            const i = samples.length;
            samples.push({ offset: o, size: sampleSize(i), dts: dtsList[i] / ts, cts: ctsList[i] / ts, sync: sync[i] === 1 });
            o += sampleSize(i);
          }
        }
      }
      if (!samples.length) continue;

      const tkhd = kids.find((b) => b.type === "tkhd");
      const trackId = tkhd ? mv.getUint32(tkhd.body + (mv.getUint8(tkhd.body) === 1 ? 20 : 12)) : tracks.length + 1;
      tracks.push({
        id: trackId,
        kind,
        codec: em.codec,
        videoMux: em.videoMux,
        description: em.description,
        width: em.width,
        height: em.height,
        channels: em.channels,
        sampleRate: em.sampleRate,
        timescale,
        duration,
        fps: kind === "video" ? samples.length / Math.max(0.1, duration) : 0,
        samples,
      });
    } catch {
      // track rusak — lewati, jangan bunuh seluruh parse
    }
  }
  return { tracks, size };
}

/** indeks sampel keyframe terdekat DENGAN cts <= t (titik mulai decode) */
export function keyframeIndexAt(tr: DemuxTrackInfo, t: number): number {
  const s = tr.samples;
  let lo = 0;
  let hi = s.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].cts <= t + 0.02) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  let i = ans;
  while (i > 0 && !s[i].sync) i--;
  if (!s[i].sync) {
    // tak ada keyframe sebelum t — maju ke keyframe pertama
    i = 0;
    while (i < s.length - 1 && !s[i].sync) i++;
  }
  return i;
}

/** indeks sampel pertama dengan cts >= t (binary search) */
export function firstSampleAtOrAfter(tr: DemuxTrackInfo, t: number): number {
  const s = tr.samples;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].cts < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
