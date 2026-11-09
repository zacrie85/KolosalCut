// E2E v1.4.8 — BASMI KEDIP-KEDIP pada mesin KILAT paralel
// Jalankan: node scripts/e2e-v148.mjs
// Server dev harus jalan di :3210
//
// Sumber: kctest-scenes.webm — 12 scene x 1 dtk warna solid (red,green,blue,...,
// gray), WebM/VP8 -> Turbo PASTI tidak layak ("bukan container MP4") sehingga
// SELURUH batch dirender MESIN KILAT — jalur yang di PC pengguna menghasilkan
// video kedip-kedip (badge "KILAT (decoder ...)" di laporkan pengguna).
//
// Bug v1.4.7: 4 bagian paralel satu film memakai SATU elemen <video> bersama
// (engine.elFor per aset) → pompa saling play/seek → frame hasil diambil dari
// posisi acak → KEDIP-KEDIP. Fix v1.4.8: elemen KHUSUS per bagian (work.videoEls).
//
// ASSERTION PENANGKAL KEDIP: tiap bagian dirender dgn 3 scene urut (bagian ke-k =
// scene 3k,3k+1,3k+2). Bila pompa saling ganggu, warna frame akan LOMPAT BALIK/
// acak → tes gagal. Render benar = urutan scene TIDAK TURUN + ketiga scene ada.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const VIDEO = "/home/z/my-project/upload/kctest-scenes.webm";
const BASE = "http://localhost:3210";
const OUT_DIR = "/tmp/kc-e2e-v148";
const WANT_PARTS = 4;
const SCENES_PER_PART = 3; // 12 scene / 4 bagian
const PALETTE = [
  [255, 0, 0], [0, 128, 0], [0, 0, 255], [255, 255, 0],
  [255, 0, 255], [0, 255, 255], [255, 165, 0], [128, 0, 128],
  [255, 192, 203], [0, 128, 128], [0, 100, 0], [128, 128, 128],
];
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log("[E2E]", ...a);
const sceneOf = (r, g, b) => {
  let best = -1, bd = Infinity;
  for (let j = 0; j < PALETTE.length; j++) {
    const d = (PALETTE[j][0]-r)**2 + (PALETTE[j][1]-g)**2 + (PALETTE[j][2]-b)**2;
    if (d < bd) { bd = d; best = j; }
  }
  // frame campuran (transisi/teks) dibiarkan ambigu: jarak terlalu jauh = tak dipakai
  return bd <= 60 * 60 ? best : -1;
};

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"],
});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => log("PAGEERROR:", String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

// ===== 1. tambah video =====
const input = page.locator('input[type="file"]').first();
await input.setInputFiles(VIDEO);
log("video 12-scene WebM ditambahkan (Turbo otomatis gugur: bukan MP4)...");
await page.waitForFunction(() => document.body.innerText.includes("SIAP"), { timeout: 90000 });
log("video SIAP ✓");

// ===== 2. setel mode "Berapa bagian" = 4 =====
await page.getByText("EKSPORT & SPLIT", { exact: false }).first().click();
await page.getByText("Berapa bagian", { exact: false }).first().click();
await page.waitForTimeout(300);
await page.locator('input[type="number"]').first().fill(String(WANT_PARTS));
await page.waitForTimeout(300);

// ===== 3. MULAI EKSPORT =====
await page.getByRole("button", { name: /MULAI EKSPORT/ }).first().click();
log("MULAI EKSPORT diklik — batch 4 bagian paralel via MESIN KILAT...");

const t0 = Date.now();
let finalLabel = "";
let finalProgress = -1;
let sawKilatBadge = false;
let sawTurboBadge = false;
while (Date.now() - t0 < 420000) {
  await page.waitForTimeout(4000);
  const nova = await page.evaluate(() => {
    const st = window.__NOVA__?.getState?.();
    if (!st) return null;
    return {
      label: st.exportState.label,
      progress: st.exportState.progress,
      running: st.exportState.running,
      jobs: st.batchJobs.map((j) => j.label ?? ""),
      results: st.exportState.results.map((r) => r.name),
    };
  });
  if (nova) {
    if (nova.jobs.some((l) => /KILAT/.test(l))) sawKilatBadge = true;
    if (nova.jobs.some((l) => /TURBO/.test(l))) sawTurboBadge = true;
    log(`t+${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(nova));
    if (nova.label.startsWith("Batch selesai") || nova.label.startsWith("Gagal")) {
      finalLabel = nova.label;
      finalProgress = nova.progress;
      break;
    }
  }
}

if (!finalLabel || !finalLabel.startsWith("Batch selesai")) {
  console.error("E2E GAGAL —", finalLabel || "batch tidak selesai dalam 7 menit");
  process.exit(1);
}
if (finalProgress !== 1) {
  console.error(`E2E GAGAL — progres akhir ${finalProgress} (harus 1)`);
  process.exit(1);
}
if (!sawKilatBadge || sawTurboBadge) {
  console.error(`E2E GAGAL — badge mesin salah: KILAT=${sawKilatBadge} TURBO=${sawTurboBadge} (tes ini WAJIB di jalur KILAT)`);
  process.exit(1);
}
log(`batch tamat: "${finalLabel}" progress=1 ✓ badge KILAT ✓ (jalur kilat terverifikasi)`);

// ===== 4. jumlah file tepat N =====
const nova = await page.evaluate(() => {
  const st = window.__NOVA__?.getState?.();
  return st ? { results: st.exportState.results.map((r) => ({ name: r.name, url: r.url })) } : null;
});
const results = nova?.results ?? [];
if (results.length !== WANT_PARTS) {
  console.error(`E2E GAGAL — hasil ${results.length} file, harus tepat ${WANT_PARTS}`);
  process.exit(1);
}
log(`hasil: tepat ${results.length} file ✓`);

// ===== 5. UNDUH + PROBE + CEK URUTAN SCENE (anti-kedip) =====
for (const r of results) {
  const b64 = await page.evaluate(async (u) => {
    const b = await (await fetch(u)).arrayBuffer();
    const v = new Uint8Array(b);
    let s = "";
    for (let i = 0; i < v.length; i += 0x8000) s += String.fromCharCode(...v.subarray(i, i + 0x8000));
    return btoa(s);
  }, r.url);
  const buf = Buffer.from(b64, "base64");
  const f = path.join(OUT_DIR, r.name);
  fs.writeFileSync(f, buf);
  const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name", "-of", "csv", f]).toString().trim();
  if (!/h264/.test(probe)) {
    console.error(`E2E GAGAL — ${r.name} bukan H.264: ${probe}`);
    process.exit(1);
  }
  const dur = Number(probe.split(",").pop());
  const m = r.name.match(/part-(\d+)-/);
  const partIdx = m ? Number(m[1]) - 1 : -1;
  log(`PROBE ${r.name} (${(buf.byteLength / 1024 / 1024).toFixed(2)}MB) dur=${dur.toFixed(2)}s: ${probe.replaceAll("\n", " | ")}`);

  // ---- cek urutan scene pada area KONTEN (setelah cover ±2 dtk) ----
  // bagian ke-k (0-based) berisi scene 3k, 3k+1, 3k+2 — urut & tanpa lompat balik.
  // SAMPEL pusat frame (tanpa teks judul/label & bingkai neon di tepi) supaya
  // klasifikasi warna bersih; 0,15 dtk terakhir dibuang (frame batas part).
  const fpsSamp = 10;
  const raw = execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-ss", "2.5", // lewati cover (2 dtk) + jarak aman transisi
    "-t", `${Math.max(0.5, dur - 2 - 0.2)}`,
    "-i", f,
    "-vf", "fps=10,crop=iw*0.5:ih*0.4,scale=1:1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ], { maxBuffer: 64 * 1024 * 1024 });
  const n = raw.length / 3;
  const lo = partIdx * SCENES_PER_PART;
  const hi = lo + SCENES_PER_PART - 1;
  const seen = new Set();
  let prevSc = -1;
  let regressions = 0; // transisi turun (scene kembali ke belakang) = kedip
  let ambiguous = 0;
  let wrongRange = 0;
  for (let i = 0; i < n; i++) {
    const sc = sceneOf(raw[3 * i], raw[3 * i + 1], raw[3 * i + 2]);
    if (sc < 0) { ambiguous++; continue; }
    seen.add(sc);
    if (sc < lo || sc > hi) wrongRange++;
    if (prevSc >= 0 && sc < prevSc) regressions++; // LOMPAT BALIK = kedip
    prevSc = sc;
  }
  log(`SCENE part-${partIdx + 1}: frames=${n} terklasifikasi=${n - ambiguous} ambigu=${ambiguous} scenes=${[...seen].sort().join(",")} salahRentang=${wrongRange} LOMPATBALIK=${regressions}`);
  if (wrongRange > Math.max(2, (n - ambiguous) * 0.1)) {
    console.error(`E2E GAGAL — ${r.name}: ${wrongRange} frame dari scene DI LUAR rentang ${lo}-${hi} (frame dari posisi video yang salah = KEDIP)`);
    process.exit(1);
  }
  if (regressions > Math.max(2, (n - ambiguous) * 0.1)) {
    console.error(`E2E GAGAL — ${r.name}: ${regressions} lompatan balik urutan scene (= KEDIP-KEDIP)`);
    process.exit(1);
  }
  const missing = [];
  for (let s = lo; s <= hi; s++) if (!seen.has(s)) missing.push(s);
  if (missing.length) {
    console.error(`E2E GAGAL — ${r.name}: scene ${missing.join(",")} hilang (isi bagian tidak lengkap)`);
    process.exit(1);
  }
}

await browser.close();
log("E2E v1.4.8 LULUS ✓✓✓ — 4 bagian KILAT paralel, urutan scene benar semua, TIDAK ada kedip-kedip");
