#!/usr/bin/env node
/* E2E: unggah video uji -> proses dengan judul -> ekstrak frame cover hasil */
import fs from "fs";
import path from "path";

const BASE = "http://127.0.0.1:3000";
const WORK = "/home/z/my-project/scripts/cover-repro";
const SRC = path.join(WORK, "test.mp4");

const buf = fs.readFileSync(SRC);

// 1) unggah (raw body + header x-file-name, persis upload-client.ts)
const up = await fetch(`${BASE}/api/upload`, {
  method: "POST",
  headers: {
    "x-file-name": encodeURIComponent("Video Uji Judul.mp4"),
    "Content-Type": "video/mp4",
  },
  body: buf,
});
const upRes = await up.json();
console.log("UPLOAD:", up.status, JSON.stringify(upRes).slice(0, 220));
if (!up.ok) process.exit(1);

// 2) proses: settings default + judul, split 4 detik agar multi bagian
// v1.3.2: dua job — judul PANJANG (uji wrap) & judul KOSONG (uji fallback nama file)
const baseSettings = {
  splitMode: "duration",
  splitSeconds: 4,
  splitParts: 3,
  coverEnabled: true,
  coverSame: false,
  coverDuration: 2,
  coverPos: "tengah",
  title: { enabled: true, text: "JUDUL E2E UJI KAWAN", relX: 0.5, relY: 0.055, size: 58, font: "anton" },
  label: { enabled: true, format: "part", prefix: "BAGIAN KE-{n}", text: "", relX: 0.5, relY: 0.14, size: 44, font: "montserrat" },
  desc: { enabled: false, text: "", relX: 0.5, relY: 0.86, size: 38, font: "carlito" },
  frame: "neon-emas",
  bars: true,
  barSize: "sedang",
  ratio: "full",
  zoom: 1,
  panX: 0.5,
  quality: "fast",
  parallel: 1,
  outputDir: "",
};

async function runJobE2E(tag, titleText, fileName) {
  const settings = JSON.parse(JSON.stringify(baseSettings));
  settings.title.text = titleText;
  const pr = await fetch(`${BASE}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId: upRes.uploadId,
      originalName: fileName,
      title: titleText.trim() || "Video Uji Judul",
      settings,
      parallel: 1,
    }),
  });
  const prRes = await pr.json();
  console.log(`PROCESS[${tag}]:`, pr.status, JSON.stringify(prRes).slice(0, 160));
  if (!pr.ok) process.exit(1);

  const jobId = prRes.jobId;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const j = await fetch(`${BASE}/api/jobs?ids=${jobId}`).then((r) => r.json());
    const job = j.jobs?.[0];
    if (!job) continue;
    console.log(`[${tag}][${i}] ${job.status} ${(job.progress * 100).toFixed(0)}% — ${job.phase}`);
    if (job.status === "done" || job.status === "error") {
      console.log(`FINAL[${tag}]:`, JSON.stringify(job, null, 2));
      if (job.status === "error") process.exit(2);
      fs.writeFileSync(path.join(WORK, `e2e-job-${tag}.json`), JSON.stringify(job, null, 2));
      return job;
    }
  }
  process.exit(3);
}

await runJobE2E("panjang", "Judul Video Yang Cukup Panjang Untuk Menguji Word Wrap Dua Baris", "Video Uji Judul.mp4");
await runJobE2E("kosong", "", "Video Uji Judul.mp4");
console.log("E2E SELESAI");
