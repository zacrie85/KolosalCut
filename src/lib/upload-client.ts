// ============================================================
// KolosalCut — klien unggah video (sisi browser)
// ============================================================
// v1.2.0: dukungan file sampai 10 GB.
// File dikirim APA ADANYA sebagai body XHR (bukan FormData) sehingga browser
// men-stream-nya dari disk tanpa memuat ke memori. Server membalas dengan
// streaming yang sama menuju disk (lihat src/app/api/upload/route.ts).

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
