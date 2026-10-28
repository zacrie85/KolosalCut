// ============================================================
// Antrean render paralel — memproses beberapa video serentak
// sesuai pilihan pengguna (1 / 2 / 3 / 5 / 7 video sekaligus).
// Urutan tetap FIFO: video pertama selalu diproses lebih dulu.
// Slot yang kosong langsung diisi antrean berikutnya: pada 2×,
// begitu SATU video selesai, video berikutnya langsung jalan
// (tidak menunggu pasangannya selesai dulu).
// ============================================================
import { Job } from "./jobs";
import { runJob } from "./ffmpeg";

const waiting: Job[] = [];
let active = 0;
let max = 2;

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

function pump(): void {
  while (active < max && waiting.length > 0) {
    const job = waiting.shift()!;
    active++;
    void runJob(job)
      .catch(() => {
        /* status error sudah dicatat runJob */
      })
      .finally(() => {
        active--;
        pump();
      });
  }
}
