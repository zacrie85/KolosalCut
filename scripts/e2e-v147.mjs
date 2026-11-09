// E2E v1.4.7 — FIX SPLIT 64 vs 30: pilihan "Berapa bagian" WAJIB dihormati
// Jalankan: node scripts/e2e-v147.mjs <path-video>
// Server dev harus jalan di :3210
// Video uji 12 detik + "Berapa bagian" = 4 -> HARUS tepat 4 file hasil
// (bug lama: splitBy dipaksa "duration" -> dipotong per splitSeconds default 60
//  -> 1 file saja; atau dgn setelan durasi lain, jumlah salah total).
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const VIDEO = process.argv[2] || "/home/z/my-project/upload/nvtest.mp4";
const BASE = "http://localhost:3210";
const OUT_DIR = "/tmp/kc-e2e-v147";
const WANT_PARTS = 4;
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log("[E2E]", ...a);

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"],
});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => log("PAGEERROR:", String(e).slice(0, 300)));
page.on("console", (m) => {
  const t = m.text();
  if (/error|gagal|macet/i.test(t) && !/Download the React DevTools|radix/i.test(t)) log("CONSOLE:", t.slice(0, 220));
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

// ===== 1. tambah video =====
const input = page.locator('input[type="file"]').first();
await input.setInputFiles(VIDEO);
log("video ditambahkan, menunggu unggahan + probe...");
await page.waitForFunction(() => document.body.innerText.includes("SIAP"), { timeout: 90000 });
log("video SIAP ✓");

// ===== 2. setel mode "Berapa bagian" = 4 =====
await page.getByText("EKSPORT & SPLIT", { exact: false }).first().click();
await page.getByText("Berapa bagian", { exact: false }).first().click();
await page.waitForTimeout(300);
const num = page.locator('input[type="number"]').first();
await num.fill(String(WANT_PARTS));
await page.waitForTimeout(300);
// estimasi panel harus sudah menjanjikan tepat 4 file
const est = await page.evaluate(() => document.body.innerText.match(/→\s*±(\d+)\s*file hasil/)?.[1] ?? "");
log(`estimasi panel: "±${est} file hasil" (harus ${WANT_PARTS})`);
if (Number(est) !== WANT_PARTS) {
  console.error(`E2E GAGAL — estimasi panel ±${est}, harus ${WANT_PARTS}`);
  process.exit(1);
}

// ===== 3. MULAI EKSPORT =====
await page.getByRole("button", { name: /MULAI EKSPORT/ }).first().click();
log("MULAI EKSPORT diklik — mesin NOVACUT berjalan...");

const t0 = Date.now();
let finalLabel = "";
let finalProgress = -1;
while (Date.now() - t0 < 420000) {
  await page.waitForTimeout(4000);
  const nova = await page.evaluate(() => {
    const st = window.__NOVA__?.getState?.();
    if (!st) return null;
    return {
      splitBy: st.exportSettings.splitBy,
      label: st.exportState.label,
      progress: st.exportState.progress,
      running: st.exportState.running,
      results: st.exportState.results.map((r) => `${r.name} ${(r.size / 1024 / 1024).toFixed(2)}MB`),
    };
  });
  if (nova) {
    log(`t+${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(nova));
    if (nova.splitBy !== "count") {
      console.error(`E2E GAGAL — exportSettings.splitBy = "${nova.splitBy}", harus "count" (inti fix v1.4.7)`);
      process.exit(1);
    }
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
log(`batch tamat: "${finalLabel}" progress=1 ✓ splitBy=count ✓`);

// ===== 4. jumlah file HARUS tepat N =====
const nova = await page.evaluate(() => {
  const st = window.__NOVA__?.getState?.();
  return st ? { results: st.exportState.results.map((r) => ({ name: r.name, size: r.size, url: r.url })) } : null;
});
const results = nova?.results ?? [];
log(`hasil: ${results.length} file (harus tepat ${WANT_PARTS})`);
if (results.length !== WANT_PARTS) {
  console.error(`E2E GAGAL — hasil ${results.length} file, HARUS tepat ${WANT_PARTS} (bug 64 vs 30!)`);
  process.exit(1);
}
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
  const probe = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,width,height",
    "-of", "csv", f,
  ]).toString().trim();
  log(`PROBE ${r.name} (${(buf.byteLength / 1024 / 1024).toFixed(2)}MB): ${probe.replaceAll("\n", " | ")}`);
  if (!/h264/.test(probe)) {
    console.error(`E2E GAGAL — ${r.name} bukan H.264`);
    process.exit(1);
  }
}
// total durasi 4 bagian harus ≈ durasi video (12 dtk), tidak ada isi hilang
const durs = execFileSync("bash", [
  "-c",
  `for f in ${OUT_DIR}/*.mp4; do ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done`,
]).toString().trim().split("\n").map(Number);
const total = durs.reduce((a, b) => a + b, 0);
log(`total durasi ${durs.length} bagian: ${total.toFixed(2)} dtk (video sumber ±12 dtk)`);
if (total < 11) {
  console.error(`E2E GAGAL — total durasi hasil ${total.toFixed(2)} dtk < 11 dtk (ada isi hilang)`);
  process.exit(1);
}

await browser.close();
log(`E2E v1.4.7 LULUS ✓✓✓ — "Berapa bagian"=${WANT_PARTS} tepat ${results.length} file, batch tamat 100%`);
