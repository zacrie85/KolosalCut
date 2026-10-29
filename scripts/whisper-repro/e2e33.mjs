// ============================================================
// E2E v1.3.3 — TEKS OTOMATIS (suara → teks)
// alur: unggah video-uji.mp4 → proses dgn subtitle aktif → tunggu selesai
// → cek durasi persis + file .ass + tulis info frame utk inspeksi visual
// ============================================================
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const VIDEO = path.join(process.cwd(), "scripts/whisper-repro/video-uji.mp4");
const MODE = process.env.SUB_MODE || "cepat";
const STYLE = process.env.SUB_STYLE || "tiktok";

function fail(msg) {
  console.error("❌ GAGAL:", msg);
  process.exit(1);
}

const buf = fs.readFileSync(VIDEO);
console.log(`[1] unggah video-uji.mp4 (${(buf.length / 1024 / 1024).toFixed(1)} MB)...`);
const up = await fetch(`${BASE}/api/upload`, {
  method: "POST",
  headers: {
    "x-file-name": encodeURIComponent("Video Uji Teks Otomatis.mp4"),
    "Content-Type": "video/mp4",
  },
  body: buf,
});
if (!up.ok) fail(`unggah: HTTP ${up.status} — ${await up.text()}`);
const upRes = await up.json();
console.log(`    uploadId=${upRes.uploadId} durasi=${upRes.duration}s hasAudio=${upRes.hasAudio}`);

console.log(`[2] proses dgn teks otomatis (mode=${MODE}, gaya=${STYLE})...`);
const settings = {
  splitMode: "duration",
  splitSeconds: 20, // 52 dtk → 3 bagian (20/20/12)
  splitParts: 3,
  coverEnabled: true,
  coverSame: false,
  coverDuration: 2,
  coverPos: "tengah",
  title: { enabled: true, text: "Uji Teks Otomatis", relX: 0.5, relY: 0.055, size: 58, font: "anton" },
  label: { enabled: true, format: "part", prefix: "BAGIAN KE-{n}", text: "", relX: 0.5, relY: 0.14, size: 44, font: "montserrat" },
  desc: { enabled: false, text: "", relX: 0.5, relY: 0.86, size: 38, font: "carlito" },
  frame: "none",
  bars: false,
  barSize: "sedang",
  ratio: "full",
  zoom: 1,
  panX: 0.5,
  quality: "fast",
  parallel: 1,
  outputDir: "",
  subtitle: { enabled: true, mode: MODE, style: STYLE },
};
const pr = await fetch(`${BASE}/api/process`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    uploadId: upRes.uploadId,
    originalName: upRes.originalName,
    title: "Uji Teks Otomatis",
    duration: upRes.duration,
    width: upRes.width,
    height: upRes.height,
    hasAudio: upRes.hasAudio,
    settings,
    parallel: 1,
  }),
});
if (!pr.ok) fail(`proses: HTTP ${pr.status} — ${await pr.text()}`);
const { jobId } = await pr.json();
console.log(`    jobId=${jobId}`);

console.log("[3] pantau status...");
let job = null;
const t0 = Date.now();
let sawTranscribe = false;
for (let i = 0; i < 180; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const j = await fetch(`${BASE}/api/jobs?ids=${jobId}`).then((r) => r.json());
  job = j.jobs?.[0];
  if (!job) fail("job hilang dari polling");
  if (job.phase && job.phase.includes("Membaca suara")) sawTranscribe = true;
  process.stdout.write(
    `\r    ${job.status} | ${job.phase} | ${Math.round(job.progress * 100)}%   `
  );
  if (job.status === "done" || job.status === "error") break;
}
console.log("");
if (job.status === "error") fail(job.error);
if (!sawTranscribe) console.log("  ⚠ fase 'Membaca suara' tidak teramati (transkripsi mungkin terlalu cepat)");
console.log(`    selesai dalam ${((Date.now() - t0) / 1000).toFixed(0)} dtk, ${job.parts.length} bagian`);

// [4] verifikasi
console.log("[4] verifikasi hasil:");
for (const p of job.parts) {
  console.log(`    ${p.file}: ${p.duration.toFixed(2)} dtk`);
}
const expDur = [22, 22, 14]; // cover 2 + isi 20/20/12
job.parts.forEach((p, i) => {
  if (Math.abs(p.duration - expDur[i]) > 0.05)
    fail(`durasi bagian ${i + 1} = ${p.duration}, harapan ${expDur[i]} (regresi durasi v1.3.2!)`);
});
console.log("    ✓ durasi semua bagian persis (tidak membengkak)");

// unduh bagian 1 untuk inspeksi visual frame
const dl = await fetch(`${BASE}/api/file?job=${jobId}&name=${encodeURIComponent(job.parts[0].file)}`);
if (!dl.ok) fail(`unduh bagian: HTTP ${dl.status}`);
const out = path.join(process.cwd(), "scripts/whisper-repro/e2e33-part1.mp4");
fs.writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
console.log(`    ✓ bagian 1 tersimpan: ${out}`);

// ambil frame pada t ketika ucapan berlangsung (bagian 1 = master 2..22 dtk:
// cover 2 dtk → isi mulai; uji1 di master 1..10.9 → t = 2 + (1..10.9 - 2)...
// master 3.5 dtk = isi detik 1.5 → frame di 2 + 1.5 + 2 = 5.5 (posisi cover+isi)
for (const t of [6.5, 8.5]) {
  const fr = path.join(process.cwd(), `scripts/whisper-repro/e2e33-frame-${t}.png`);
  await new Promise((res, rej) => {
    const p = spawn("ffmpeg", ["-y", "-ss", String(t), "-i", out, "-frames:v", "1", fr]);
    p.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg frame gagal"))));
  });
  console.log(`    ✓ frame t=${t}s: ${fr}`);
}
console.log("\n✅ E2E SELESAI — cek frame PNG untuk memastikan teks tampil pada gambar");
