// ============================================================
// KolosalCut v1.4.0 — E2E MESIN NOVACUT di headless Chromium
// Alur nyata lewat UI: tambah video → unggah → MULAI EKSPORT
// → tunggu SELESAI → tangkap file hasil → probe dengan ffprobe.
// Jalankan: node scripts/e2e-novacut-engine.mjs <path-video> <mode>
//   mode: "split" (3 bagian) atau "single" (1 file utuh)
// ============================================================
import { chromium } from "playwright";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const VIDEO = process.argv[2] || "/home/z/my-project/upload/nvtest.mp4";
const MODE = process.argv[3] || "single";
const BASE = "http://localhost:3210";
const OUT_DIR = "/tmp/kc-e2e-out";
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
  if (/error|gagal|warn/i.test(t) && !/Download the React DevTools/.test(t)) log("CONSOLE:", t.slice(0, 220));
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

// ===== 1. tambah video lewat input ImportZone =====
const input = page.locator('input[type="file"]').first();
await input.setInputFiles(VIDEO);
log("video ditambahkan, menunggu unggahan + probe...");

// tunggu status SIAP (maks 90 dtk — unggah 1,2 MB cepat)
await page.waitForFunction(
  () => document.body.innerText.includes("SIAP"),
  { timeout: 90000 }
);
log("video SIAP ✓");

// ===== 2. setel split: 3 bagian @ durasi / EKSPORT SAJA =====
if (MODE === "split") {
  // panel EKSPORT & SPLIT: pilih "EKSPORT & SPLIT" lalu durasi 4 detik
  await page.getByText("EKSPORT & SPLIT", { exact: false }).first().click();
  await page.getByText("Durasi per video").first().click();
  const dur = page.locator('input[type="number"]').first();
  await dur.fill("4");
  log("setelan: split @4 detik");
} else {
  await page.getByText("EKSPORT SAJA", { exact: false }).first().click();
  log("setelan: eksport saja (1 file utuh)");
}

// ===== 3. klik MULAI EKSPORT + tangkap unduhan (mode web = blob) =====
const dlPromise = page.waitForEvent("download", { timeout: 420000 }).catch(() => null);
await page.getByRole("button", { name: /MULAI EKSPORT/ }).first().click();
log("MULAI EKSPORT diklik — mesin NOVACUT berjalan...");

// pantau status baris antrean sampai SELESAI/GAGAL (maks 7 menit)
const t0 = Date.now();
let finalState = "";
while (Date.now() - t0 < 420000) {
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body.innerText);
  const nova = await page.evaluate(() => {
    const st = window.__NOVA__?.getState?.();
    if (!st) return null;
    return {
      label: st.exportState.label,
      progress: st.exportState.progress,
      jobs: st.batchJobs.map((j) => `${j.status}:${j.label ?? ""}:${Math.round(j.progress * 100)}%`),
      results: st.exportState.results.map((r) => `${r.name} ${(r.size / 1024 / 1024).toFixed(2)}MB`),
    };
  });
  if (nova) log(`t+${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(nova));
  if (body.includes("RENDER SELESAI") || body.includes("RENDER GAGAL") || (nova && nova.label.startsWith("Batch selesai"))) {
    finalState = nova?.label ?? "";
    break;
  }
}

const nova = await page.evaluate(() => {
  const st = window.__NOVA__?.getState?.();
  return st
    ? {
        label: st.exportState.label,
        jobs: st.batchJobs.map((j) => ({ status: j.status, label: j.label })),
        results: st.exportState.results.map((r) => ({ name: r.name, size: r.size, url: r.url })),
      }
    : null;
});
log("STATUS AKHIR:", JSON.stringify(nova, null, 1));

// ===== 4. tangkap file hasil (unduhan blob) =====
const dl = await dlPromise;
let outFile = null;
if (dl) {
  outFile = path.join(OUT_DIR, dl.suggestedFilename());
  await dl.saveAs(outFile);
  log("hasil diunduh:", outFile, fs.statSync(outFile).size, "bytes");
} else {
  log("tidak ada event download (mode desktop mungkin) — periksa results url");
  const urls = nova?.results.filter((r) => r.url) ?? [];
  if (urls.length) {
    const buf = await page.evaluate(async (u) => await (await fetch(u)).arrayBuffer(), urls[0].url);
    outFile = path.join(OUT_DIR, urls[0].name);
    fs.writeFileSync(outFile, Buffer.from(buf));
    log("hasil diambil dari blob url:", outFile, buf.byteLength, "bytes");
  }
}

await browser.close();

if (!outFile || !fs.existsSync(outFile) || fs.statSync(outFile).size < 10000) {
  console.error("E2E GAGAL — file hasil tidak ditemukan/terlalu kecil");
  process.exit(1);
}

// ===== 5. probe hasil =====
const probe = execFileSync("ffprobe", [
  "-v", "error",
  "-show_entries", "format=duration,format_name:stream=codec_name,width,height",
  "-of", "csv", outFile,
]).toString();
console.log("PROBE HASIL:\n" + probe);
log("E2E LULUS ✓✓✓");
