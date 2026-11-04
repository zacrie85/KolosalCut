// ============================================================
// KolosalCut v1.4.0 — klien teks otomatis untuk mesin NOVACUT
// Pengenalan suara tetap whisper-cli OFFLINE milik KolosalCut
// (dijalankan server lokal aplikasi), hasilnya berformat
// SubSegment (waktu SUMBER video) yang sama dengan NOVACUT,
// sehingga exporter memetakan ke timeline lewat mapSubsToTimeline.
// ============================================================
import type { MediaAsset } from "./types";

export interface SubSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeProgress {
  stage: "muat" | "salin" | "unduh";
  pct?: number;
  label?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Transkripsi satu video (waktu sumber) via server lokal KolosalCut.
 * `level`: "ringan" | "sedang" | "akurat" → mode whisper-cli terdekat.
 */
export async function transcribeAsset(
  asset: MediaAsset,
  level: "ringan" | "sedang" | "akurat",
  onProgress?: (p: TranscribeProgress) => void
): Promise<SubSegment[]> {
  const uploadId = (asset as MediaAsset & { kcUploadId?: string }).kcUploadId;
  if (!uploadId) return [];
  const mode = level === "akurat" ? "akurat" : level === "sedang" ? "cepat" : "sangat-cepat";

  onProgress?.({ stage: "muat", label: "Menyiapkan teks otomatis..." });
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, mode }),
  });
  const data = (await res.json()) as { taskId?: string; error?: string };
  if (!res.ok || !data.taskId) {
    throw new Error(data.error || "Gagal memulai teks otomatis");
  }

  // pantau tugas sampai selesai (maks 30 menit per video)
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 30 * 60_000) {
      throw new Error("Teks otomatis melebihi batas waktu");
    }
    await sleep(1500);
    let st: { status?: string; progress?: number; error?: string; segments?: SubSegment[] };
    try {
      const r = await fetch(`/api/transcribe?task=${encodeURIComponent(data.taskId)}`);
      st = (await r.json()) as typeof st;
    } catch {
      continue; // jaringan lokal tersendat — coba lagi
    }
    if (st.error && st.status !== "error") throw new Error(st.error);
    if (st.status === "error") throw new Error(st.error || "Teks otomatis gagal");
    if (typeof st.progress === "number" && st.progress > 0) {
      onProgress?.({
        stage: "salin",
        pct: st.progress,
        label: `Mengenali suara... ${Math.round(st.progress * 100)}%`,
      });
    }
    if (st.status === "done") {
      onProgress?.({ stage: "salin", pct: 1, label: "Teks otomatis siap" });
      return (st.segments ?? []).filter(
        (s) => Number.isFinite(s.start) && Number.isFinite(s.end) && !!s.text?.trim()
      );
    }
  }
}
