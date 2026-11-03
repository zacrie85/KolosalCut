// ============================================================
// Antrean render paralel — memproses beberapa video serentak
// sesuai pilihan pengguna (1 / 2 / 3 / 5 / 7 video sekaligus).
// Urutan tetap FIFO: video pertama selalu diproses lebih dulu.
// Slot yang kosong langsung diisi antrean berikutnya: pada 2×,
// begitu SATU video selesai, video berikutnya langsung jalan
// (tidak menunggu pasangannya selesai dulu).
//
// v1.3.5 (anti-hang, ala menu EKSPORT & SPLIT NOVACUT):
//  - job yang dibatalkan pengguna dilewati, tidak pernah jalan;
//  - peluncuran video ke-2 dst. diberi jeda 400 ms agar RAM tidak
//    tiba-tiba memuncak (sumber klasik komputer "hang" saat render
//    paralel banyak video sekaligus).
// ============================================================
import { Job } from "./jobs";
import { runJob, isCanceled } from "./ffmpeg";

const waiting: Job[] = [];
let active = 0;
let max = 2;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;

export function setParallel(n: number): void {
  max = Math.min(7, Math.max(1, Math.round(Number(n)) || 1));
  pump();
}

export function getParallel(): number {
  return max;
}

export function queueLength(): number {
  return waiting.length;
}

export function activeCount(): number {
  return active;
}

export function enqueue(job: Job): void {
  waiting.push(job);
  pump();
}

function launch(job: Job): void {
  void runJob(job)
    .catch(() => {
      /* status error sudah dicatat runJob */
    })
    .finally(() => {
      active--;
      pump();
    });
}

function pump(): void {
  if (pumpTimer) return; // pompa sudah terjadwal — hindari gelombang ganda
  const ready = active < max && waiting.length > 0;
  if (!ready) return;
  pumpTimer = setTimeout(() => {
    pumpTimer = null;
    while (active < max && waiting.length > 0) {
      const job = waiting.shift()!;
      // v1.3.5: job yang sudah dibatalkan tidak pernah dijalankan
      if (isCanceled(job)) {
        job.status = "canceled";
        job.phase = "Dibatalkan";
        continue;
      }
      active++;
      if (active === 1 || waiting.length === 0) {
        launch(job); // video pertama langsung jalan tanpa jeda
      } else {
        // jeda singkat antar peluncuran: mencegah N ffmpeg bermunculan
        // dalam milidetik yang sama (lonjakan RAM -> hang/swap)
        const j = job;
        setTimeout(() => {
          if (isCanceled(j)) {
            j.status = "canceled";
            j.phase = "Dibatalkan";
            active--;
            pump();
            return;
          }
          launch(j);
        }, 400);
      }
    }
  }, 30);
}
