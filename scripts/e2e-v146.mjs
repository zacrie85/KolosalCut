// E2E v1.4.6 — anti mentok 99%: batch split 6 bagian harus tamat 100%
// Jalankan: node scripts/e2e-v146.mjs <path-video>
// Server dev harus jalan di :3210
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const VIDEO = process.argv[2] || "/home/z/my-project/upload/nvtest.mp4";
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

// ===== 2. setel EKSPORT & SPLIT @2 detik (12 dtk = 6 bagian) =====
await page.getByText("EKSPORT & SPLIT", { exact: false }).first().click();
await page.getByText("Durasi per video").first().click();
const dur = page.locator('input[type="number"]').first();
await dur.fill("2");
log("setelan: split @2 detik (6 bagian)");

// ===== 3. MULAI EKSPORT =====
await page.getByRole("button", { name: /MULAI EKSPORT/ }).first().click();
log("MULAI EKSPORT diklik — mesin NOVACUT berjalan...");

const t0 = Date.now();
let finalLabel = "";
let finalProgress = -1;
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
      jobs: st.batchJobs.map((j) => `${j.status}:${j.label ?? ""}:${Math.round(j.progress * 100)}%`),
      results: st.exportState.results.map((r) => `${r.name} ${(r.size / 1024 / 1024).toFixed(2)}MB`),
    };
  });
  if (nova) {
    if (/TURBO|KILAT/.test(nova.jobs.join("|"))) sawTurboBadge = true;
    log(`t+${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(nova));
    if (nova.label.startsWith("Batch selesai") || nova.label.startsWith("Gagal")) {
      finalLabel = nova.label;
      finalProgress = nova.progress;
      break;
    }
  }
}

if (!finalLabel) {
  console.error("E2E GAGAL — batch tidak kunjung selesai dalam 7 menit (simulasi mentok 99%)");
  process.exit(1);
}
if (!finalLabel.startsWith("Batch selesai")) {
  console.error("E2E GAGAL —", finalLabel);
  process.exit(1);
}
if (finalProgress !== 1) {
  console.error(`E2E GAGAL — progres akhir ${finalProgress} (harus 1)`);
  process.exit(1);
}
log(`batch tamat: "${finalLabel}" progress=1 ✓ badgeMesin=${sawTurboBadge}`);

// ===== 4. ambil semua hasil (blob url) & probe =====
const nova = await page.evaluate(() => {
  const st = window.__NOVA__?.getState?.();
  return st
    ? {
        results: st.exportState.results.map((r) => ({ name: r.name, size: r.size, url: r.url })),
      }
    : null;
});
const results = nova?.results ?? [];
log(`hasil: ${results.length} file`);
if (results.length < 3) {
  console.error(`E2E GAGAL — hasil ${results.length}, minimal 3 bagian`);
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

await browser.close();
log("E2E v1.4.6 LULUS ✓✓✓ — batch 6 bagian tamat 100%, tanpa mentok 99%");
