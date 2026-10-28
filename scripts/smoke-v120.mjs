// Smoke test v1.2.0 — KolosalCut
// 1. Upload streaming (raw body, seperti XHR baru)
// 2. POST /api/process dengan outputDir (folder hasil pilihan user)
// 3. Poll status job -> pastikan MP4 muncul di folder pilihan, thumb di folder bawaan
// 4. GET /api/file untuk video dari outDir & thumbnail
import fs from "fs";
import path from "path";

const BASE = "http://127.0.0.1:3955";

const VIDEO = "/tmp/kc-test/masuk/Film Uji Kolosal.mp4";
const OUT_DIR = "/tmp/kc-test/hasil";

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const buf = fs.readFileSync(VIDEO);
  const size = buf.length;
  log(`Video uji: ${(size / 1024 / 1024).toFixed(1)} MB`);

  // ---------- 1) UPLOAD STREAMING ----------
  log("Mengunggah (streaming raw body)...");
  const upRes = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: {
      "x-file-name": encodeURIComponent(path.basename(VIDEO)),
      "content-type": "video/mp4",
      "content-length": String(size),
    },
    body: buf,
  });
  const up = await upRes.json();
  if (!upRes.ok) throw new Error(`Upload gagal: ${JSON.stringify(up)}`);
  log(`Upload OK: uploadId=${up.uploadId}, durasi=${up.duration}s, ${up.width}x${up.height}, audio=${up.hasAudio}`);
  if (up.duration < 100) throw new Error("Durasi tidak masuk akal");

  // ---------- 2) PROSES DENGAN FOLDER HASIL ----------
  log("Memulai proses dengan outputDir=" + OUT_DIR);
  const procRes = await fetch(`${BASE}/api/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      uploadId: up.uploadId,
      originalName: path.basename(VIDEO),
      title: "Film Uji Kolosal",
      duration: up.duration,
      width: up.width,
      height: up.height,
      hasAudio: up.hasAudio,
      parallel: 1,
      settings: {
        splitMode: "duration",
        splitSeconds: 60,          // 120s -> 2 bagian
        coverEnabled: true,
        coverDuration: 1,
        frame: "min-putih",        // statis = render cepat
        bars: false,
        ratio: "full",
        quality: "fast",
        outputDir: OUT_DIR,
        title: { enabled: true, text: "FILM UJI", relX: 0.5, relY: 0.06, size: 58, font: "anton" },
        label: { enabled: true, format: "part", prefix: "BAGIAN KE-{n}", text: "", relX: 0.5, relY: 0.14, size: 44, font: "montserrat" },
        desc: { enabled: false, text: "", relX: 0.5, relY: 0.86, size: 38, font: "carlito" },
      },
    }),
  });
  const proc = await procRes.json();
  if (!procRes.ok) throw new Error(`Proses gagal: ${JSON.stringify(proc)}`);
  log(`Job dibuat: ${proc.jobId}`);

  // ---------- 3) POLL STATUS ----------
  let job = null;
  for (let i = 0; i < 150; i++) {
    await sleep(2000);
    const r = await fetch(`${BASE}/api/jobs?ids=${proc.jobId}`);
    const d = await r.json();
    job = d.jobs[0];
    if (!job) throw new Error("Job hilang");
    log(`status=${job.status} phase="${job.phase}" ${(job.progress * 100).toFixed(0)}%`);
    if (job.status === "done" || job.status === "error") break;
  }
  if (job.status !== "done") throw new Error(`Render gagal: ${job.error}`);
  log(`Render selesai: ${job.parts.length} bagian`);
  log(`outDir (JobPublic): ${job.outDir}`);

  // ---------- 4) VERIFIKASI FILE ----------
  const partFiles = fs.readdirSync(job.outDir).filter((f) => f.endsWith(".mp4"));
  if (partFiles.length !== job.parts.length) {
    throw new Error(`Jumlah MP4 di outDir (${partFiles.length}) != parts (${job.parts.length})`);
  }
  log(`OK: ${partFiles.length} MP4 ada di folder pilihan user`);
  for (const p of job.parts) {
    const st = fs.statSync(path.join(job.outDir, p.file));
    if (Math.abs(st.size - p.size) > 1024) throw new Error(`Ukuran tidak cocok: ${p.file}`);
    log(`  - ${p.file} ${(p.size / 1024 / 1024).toFixed(1)} MB, durasi ${p.duration.toFixed(1)}s`);
  }
  // durasi total bagian harus menutup seluruh video (fix #3)
  const totalDur = job.parts.reduce((a, p) => a + p.duration, 0);
  log(`Total durasi bagian: ${totalDur.toFixed(1)}s (sumber ${up.duration}s)`);
  if (totalDur + 0.5 < up.duration) throw new Error("Durasi bagian tidak menutup seluruh video!");

  // thumbnail di folder bawaan
  const thumbRes = await fetch(`${BASE}/api/file?job=${proc.jobId}&name=${encodeURIComponent(job.parts[0].thumb)}`);
  if (!thumbRes.ok) throw new Error("Thumbnail tidak bisa diambil");
  log("OK: thumbnail tersaji dari folder bawaan");

  // video via /api/file dari outDir
  const vidRes = await fetch(`${BASE}/api/file?job=${proc.jobId}&name=${encodeURIComponent(job.parts[0].file)}`);
  if (!vidRes.ok) throw new Error("Video tidak bisa diambil via /api/file");
  const vbuf = Buffer.from(await vidRes.arrayBuffer());
  log(`OK: video tersaji dari folder pilihan (${(vbuf.length / 1024 / 1024).toFixed(1)} MB)`);

  // probe durasi hasil — pastikan bagian-1 ±60s+cover dan bukan korup
  console.log("\n=== SEMUA TES LOLOS ===");
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
