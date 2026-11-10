// ============================================================
// KolosalCut — klien unggah video (sisi browser)
// ============================================================
// v1.2.0: dukungan file sampai 10 GB.
// File dikirim APA ADANYA sebagai body XHR (bukan FormData) sehingga browser
// men-stream-nya dari disk tanpa memuat ke memori. Server membalas dengan
// streaming yang sama menuju disk (lihat src/app/api/upload/route.ts).
//
// v1.4.9 TANPA UNGGAH (ala NOVACUT): video tidak lagi disalin ke folder
// upload saat diimpor. Info video (durasi/resolusi/audio) diperiksa LOKAL
// lewat elemen <video> (probeLocalVideo), render memakai File lokal, dan
// salinan server hanya dibuat bila TEKS OTOMATIS dipakai di mode browser
// (desktop membaca file langsung dari path asli — nol salinan).

export interface UploadResult {
  uploadId: string;
  originalName: string;
  title: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** batas ukuran file per video (harus sama dengan server) */
export const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

export function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

/** unggah satu video dengan laporan progres (0..100) */
export function uploadVideo(
  file: File,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    // nama file dikirim via header (URL-encoded) agar aman untuk semua karakter
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 96));
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(res as UploadResult);
        } else {
          reject(new Error(res.error ?? "Gagal mengunggah video."));
        }
      } catch {
        reject(new Error("Respons server tidak valid."));
      }
    };
    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah."));
    xhr.onabort = () => reject(new Error("Unggahan dibatalkan."));
    xhr.send(file);
  });
}

/** hapus salinan sementara di folder upload server (setelah teks otomatis selesai) */
export function deleteUpload(uploadId: string): void {
  try {
    const id = uploadId.replace(/[^a-z0-9]/gi, "");
    if (!id) return;
    void fetch(`/api/upload?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* pembersihan gagal — biarkan (folder lama tetap bisa dibersihkan manual) */
  }
}

/** format video yang bisa diperiksa lokal (sama dgn daftar server) */
export const OK_EXT = [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".ts", ".flv"];

/** v1.4.9 TANPA UNGGAH — periksa info video SECARA LOKAL (nol salinan, nol jaringan):
 * durasi/resolusi dari metadata <video>, audio dideteksi dgn memutar sunyi ±0,2 dtk.
 * Bentuk hasil sama persis dengan UploadResult server (uploadId kosong). */
export function probeLocalVideo(file: File): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    let settled = false;
    const cleanup = () => {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        /* abaikan */
      }
      URL.revokeObjectURL(url);
    };
    const finish = (hasAudio: boolean) => {
      if (settled) return;
      settled = true;
      const dur = isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
      const w = el.videoWidth || 0;
      const h = el.videoHeight || 0;
      cleanup();
      if (!dur || !w || !h) {
        reject(new Error("Video tidak dapat dibaca di perangkat ini (codec tidak didukung / berkas rusak)."));
        return;
      }
      resolve({
        uploadId: "",
        originalName: file.name,
        title: file.name.replace(/\.[^.]+$/, ""),
        size: file.size,
        duration: dur,
        width: w,
        height: h,
        hasAudio,
      });
    };
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };
    el.onloadedmetadata = () => {
      // deteksi audio: webkitAudioDecodedByteCount terisi setelah decode berjalan —
      // putar sunyi sesaat (elemen tak terpasang di dokumen, tidak terlihat)
      const anyEl = el as HTMLVideoElement & {
        webkitAudioDecodedByteCount?: number;
        mozHasAudio?: boolean;
      };
      const detect = () => {
        const bc = typeof anyEl.webkitAudioDecodedByteCount === "number" ? anyEl.webkitAudioDecodedByteCount : -1;
        if (bc < 0 && typeof anyEl.mozHasAudio !== "boolean") {
          finish(true); // tidak ada indikator audio di mesin ini — anggap ada (hanya efek label)
          return;
        }
        finish(bc > 0 || anyEl.mozHasAudio === true);
      };
      const t0 = Date.now();
      el.ontimeupdate = () => {
        if (el.currentTime >= 0.05 || Date.now() - t0 > 1500) {
          el.ontimeupdate = null;
          detect();
        }
      };
      el.play().catch(() => {
        // autoplay diblokir — cek tanpa decode (umumnya video pengguna beraudio)
        finish(typeof anyEl.webkitAudioDecodedByteCount === "number" ? anyEl.webkitAudioDecodedByteCount > 0 : true);
      });
      setTimeout(() => detect(), 2500); // jaring pengaman
    };
    el.onerror = () => fail("Video tidak dapat dibaca di perangkat ini (codec tidak didukung / berkas rusak).");
    setTimeout(() => fail("Memeriksa video melebihi batas waktu."), 12000);
    el.src = url;
  });
}
