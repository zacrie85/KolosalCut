#!/usr/bin/env node
/* E2E antrean paralel: 6 video diantrikan, parallel=2.
   Sampel status tiap 250ms -> pastikan maksimal 2 job "processing"
   dan semua selesai. */
import fs from "fs";

const BASE = "http://127.0.0.1:3000";
const SRC = "/home/z/my-project/scripts/cover-repro/test.mp4";
const buf = fs.readFileSync(SRC);

// 1) satu unggahan, dipakai 6 job
const up = await fetch(`${BASE}/api/upload`, {
  method: "POST",
  headers: { "x-file-name": encodeURIComponent("Uji Paralel.mp4"), "Content-Type": "video/mp4" },
  body: buf,
});
const upRes = await up.json();
if (!up.ok) { console.error("UPLOAD GAGAL", upRes); process.exit(1); }
console.log("UPLOAD ok:", upRes.uploadId);

const mkSettings = () => ({
  splitMode: "duration", splitSeconds: 3600, splitParts: 3,
  coverEnabled: true, coverSame: false, coverDuration: 2, coverPos: "tengah",
  title: { enabled: true, text: "UJI ANTREAN PARALEL", relX: 0.5, relY: 0.055, size: 58, font: "anton" },
  label: { enabled: true, format: "part", prefix: "BAGIAN KE-{n}", text: "", relX: 0.5, relY: 0.14, size: 44, font: "montserrat" },
  desc: { enabled: false, text: "", relX: 0.5, relY: 0.86, size: 38, font: "carlito" },
  frame: "neon-emas", bars: true, barSize: "sedang",
  ratio: "full", zoom: 1, panX: 0.5, quality: "fast",
  parallel: 2, outputDir: "",
});

// 2) 6 job masuk hampir bersamaan
const jobIds = [];
for (let i = 1; i <= 6; i++) {
  const pr = await fetch(`${BASE}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId: upRes.uploadId,
      originalName: `Uji Paralel ${i}.mp4`,
      title: `Uji Paralel ${i}`,
      settings: mkSettings(),
      parallel: 2,
    }),
  });
  const r = await pr.json();
  if (!pr.ok) { console.error("PROCESS GAGAL", r); process.exit(1); }
  jobIds.push(r.jobId);
}
console.log("6 job diantrikan:", jobIds.join(","));

// 3) pantau status tiap 250ms, catat jumlah "processing" bersamaan
const done = new Set();
let maxActive = 0;
let samples = 0;
const t0 = Date.now();
while (done.size < jobIds.length && Date.now() - t0 < 600000) {
  const res = await fetch(`${BASE}/api/jobs?ids=${jobIds.join(",")}`).then((r) => r.json());
  const jobs = res.jobs ?? [];
  const active = jobs.filter((j) => j && j.status === "processing").length;
  if (active > maxActive) { maxActive = active; console.log(`  puncak aktif -> ${active}`); }
  samples++;
  jobs.forEach((j) => {
    if (j && j.status === "done" && !done.has(j.id)) {
      done.add(j.id);
      console.log(`  SELESAI ${j.id} (${done.size}/6) pada ${(Date.now() - t0) / 1000}s — aktif saat itu: ${active}`);
    }
  });
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\nHASIL: selesai ${done.size}/6, sampel ${samples}, MAKS AKTIF BERSAMAAN = ${maxActive}`);
console.log(maxActive <= 2 ? "✅ LULUS — tidak pernah melebihi 2 render serentak" : "❌ GAGAL — melebihi 2 render serentak!");
process.exit(maxActive <= 2 && done.size === 6 ? 0 : 2);
