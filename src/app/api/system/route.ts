// ============================================================
// KolosalCut v1.3.6 — API OPTIMASI HARDWARE (ala NOVACUT Studio)
// Mendeteksi spesifikasi PC (CPU, RAM, GPU) lalu menghitung
// setelan render yang paling pas: jumlah proses paralel,
// kualitas, dan jumlah thread per video — agar render berjalan
// SECEPAT MUNGKIN tanpa membuat komputer kehabisan tenaga
// (sumber klasik "hang": terlalu banyak ffmpeg + thread sekaligus).
// Semua deteksi berjalan lokal / offline.
// ============================================================
import { NextResponse } from "next/server";
import os from "os";
import { execFile } from "child_process";
import { PARALLEL_OPTIONS, ParallelKey, QualityKey } from "@/lib/video-config";

export const runtime = "nodejs";

/** Jalankan perintah singkat, kembalikan stdout atau null bila gagal/tidak ada. */
function execQuick(cmd: string, args: string[], timeoutMs = 2500): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const p = execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
        if (err || !stdout) resolve(null);
        else resolve(stdout.trim());
      });
      p.on("error", () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** Nama GPU lewat nvidia-smi (NVIDIA) atau WMI Windows — semua opsional. */
async function detectGpu(): Promise<string | null> {
  const nv = await execQuick("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], 2000);
  if (nv) return nv.split("\n")[0].trim();
  if (process.platform === "win32") {
    const ps = await execQuick(
      "powershell",
      ["-NoProfile", "-Command", "(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name"],
      3500
    );
    if (ps) return ps.split("\n")[0].trim();
  }
  return null;
}

export async function POST() {
  try {
    const cpus = os.cpus();
    const cores = Math.max(1, cpus.length);
    const cpuModel = cpus[0]?.model?.trim() || "CPU";
    const ramBytes = os.totalmem();
    const ramGB = Math.round((ramBytes / 1024 ** 3) * 10) / 10;
    const freeGB = Math.round((os.freemem() / 1024 ** 3) * 10) / 10;
    const gpu = await detectGpu();

    // ---- rekomendasi jumlah render paralel ----
    // Tiap render penuh memakai ±1,5–2 GB RAM & sebagian core. Terlalu
    // banyak video serentak pada PC lemah = RAM penuh = hang/swap.
    let parallel: ParallelKey = 1;
    if (cores >= 12 && ramGB >= 24) parallel = 5;
    else if (cores >= 8 && ramGB >= 16) parallel = 3;
    else if (cores >= 4 && ramGB >= 8) parallel = 2;
    if (!PARALLEL_OPTIONS.includes(parallel)) {
      parallel = (PARALLEL_OPTIONS[0] as ParallelKey) ?? 1;
    }

    // ---- rekomendasi kualitas ----
    // PC kuat boleh memakai kualitas tinggi tanpa terasa lambat;
    // PC pas-pasan diarahkan ke setelan ringan agar render tak bertahun.
    let quality: QualityKey = "balanced";
    if (cores <= 4 || ramGB <= 4) quality = "fast";
    else if (cores >= 12 && ramGB >= 32) quality = "high";

    // ---- thread per video: core dibagi rata antar video paralel ----
    // Mencegah seluruh core direbut semua ffmpeg sekaligus (oversubscription
    // membuat semua video lambat bersamaan & antarmuka ikut macet).
    const threadsPerJob = Math.max(1, Math.floor(cores / parallel));

    const reasons: string[] = [];
    reasons.push(`${cores} core CPU`);
    reasons.push(`RAM ${ramGB >= 1 ? ramGB.toFixed(ramGB % 1 ? 1 : 0) : "<1"} GB`);
    if (gpu) reasons.push(`GPU ${gpu}`);

    return NextResponse.json({
      platform: process.platform,
      cpuModel,
      cores,
      ramGB,
      freeGB,
      gpu,
      rec: { parallel, quality, threadsPerJob },
      reasons,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Gagal membaca spesifikasi PC: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
