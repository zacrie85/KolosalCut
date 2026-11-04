// NOVACUT Studio - impor media (dipakai bersama oleh panel Media & Mode Sederhana)

import { useEditor } from "./store";
import type { MediaAsset, MediaType } from "./types";

/** baca metadata + thumbnail dari satu file media */
export async function probeMedia(url: string, type: MediaType): Promise<{ duration: number; width: number; height: number; thumb?: string }> {
  if (type === "image") {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => res({ duration: 0, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => res({ duration: 0, width: 0, height: 0 });
      img.src = url;
    });
  }
  return new Promise((res) => {
    const el = document.createElement(type === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement;
      const meta = { duration: isFinite(el.duration) ? el.duration : 0, width: v.videoWidth || 0, height: v.videoHeight || 0, thumb: undefined as string | undefined };
      if (type === "video" && v.videoWidth) {
        v.currentTime = Math.min(0.6, (el.duration || 1) * 0.1);
        v.onseeked = () => {
          try {
            const c = document.createElement("canvas");
            const scale = 160 / v.videoWidth;
            c.width = 160;
            c.height = Math.round(v.videoHeight * scale);
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.drawImage(v, 0, 0, c.width, c.height);
              meta.thumb = c.toDataURL("image/jpeg", 0.6);
            }
          } catch {
            /* ignore */
          }
          res(meta);
        };
        setTimeout(() => res(meta), 2500);
      } else res(meta);
    };
    el.onerror = () => res({ duration: 0, width: 0, height: 0 });
    setTimeout(() => res({ duration: 0, width: 0, height: 0 }), 5000);
  });
}

/** Impor daftar file: tambahkan ke pustaka, kembalikan asset yang berhasil dibuat.
 * Pemanggil yang menentukan daftar playlist tujuan (Editor / Export Langsung). */
export async function importFiles(files: FileList | null): Promise<MediaAsset[]> {
  if (!files?.length) return [];
  const created: MediaAsset[] = [];
  for (const file of Array.from(files)) {
    const type: MediaType | null = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : null;
    if (!type) continue;
    const url = URL.createObjectURL(file);
    const meta = await probeMedia(url, type);
    const asset: MediaAsset = {
      id: `as-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`,
      name: file.name,
      type,
      url,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      thumb: meta.thumb,
      // v1.0.17: simpan objek File — mesin Turbo (WebCodecs murni) membaca film
      // lewat akses acak File.slice tanpa memuat utuh ke RAM (aman hingga GB)
      ...(type === "video" ? { file } : {}),
    };
    useEditor.getState().addAsset(asset);
    created.push(asset);
  }
  return created;
}
