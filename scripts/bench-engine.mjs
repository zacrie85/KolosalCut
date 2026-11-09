// ============================================================
// BENCHMARK MESIN — KolosalCut vs jalur Turbo / jalur penuh
// Jalankan: node scripts/bench-engine.mjs <video> [penuh]
// Ukur waktu render 9 bagian @10 dtk (video 90 dtk 1080x1920)
// ============================================================
import { chromium } from "playwright";
import fs from "fs";

const VIDEO = process.argv[2] || "/tmp/bench90.mp4";
const FORCE_PENUH = process.argv[3] === "penuh";
const BASE = "http://localhost:3210";
const log = (...a) => console.log(`[BENCH${FORCE_PENUH ? "-PENUH" : ""}]`, ...a);

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => log("PAGEERROR:", String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

// tambah video
const input = page.locator('input[type="file"]').first();
await input.setInputFiles(VIDEO);
await page.waitForFunction(() => document.body.innerText.includes("SIAP"), { timeout: 120000 });
log("video SIAP ✓");

// setel EKSPORT & SPLIT @ 10 detik
await page.getByText("EKSPORT & SPLIT", { exact: false }).first().click();
await page.getByText("Durasi per video").first().click();
const dur = page.locator('input[type="number"]').first();
await dur.fill("10");
log("setelan: split @10 detik (9 bagian)");

// opsional: paksa Render Penuh (turbo mati)
if (FORCE_PENUH) {
  await page.getByText("Render Penuh", { exact: false }).first().click();
  log("mesin: RENDER PENUH (turbo dimatikan)");
}

// mulai
const t0 = Date.now();
await page.getByRole("button", { name: /MULAI EKSPORT/ }).first().click();
log("MULAI — mesin berjalan...");

let lastPct = -1;
let finalLabel = "";
while (Date.now() - t0 < 900000) {
  await page.waitForTimeout(3000);
  const nova = await page.evaluate(() => {
    const st = window.__NOVA__?.getState?.();
    if (!st) return null;
    return {
      label: st.exportState.label,
      progress: st.exportState.progress,
      jobs: st.batchJobs.map((j) => `${j.status}:${j.label ?? ""}:${Math.round(j.progress * 100)}%`),
    };
  });
  if (!nova) continue;
  const pct = Math.round(nova.progress * 100);
  if (pct !== lastPct) {
    lastPct = pct;
    log(`t+${Math.round((Date.now() - t0) / 1000)}s  ${pct}%  ${nova.label}`);
  }
  const body = await page.evaluate(() => document.body.innerText);
  if (body.includes("RENDER SELESAI") || body.includes("RENDER GAGAL") || (nova.label && nova.label.startsWith("Batch selesai"))) {
    finalLabel = nova.label;
    break;
  }
}
const total = Math.round((Date.now() - t0) / 1000);
log(`SELESAI dalam ${total} dtk — ${finalLabel}`);
await browser.close();
fs.writeFileSync(`/tmp/bench-result${FORCE_PENUH ? "-penuh" : ""}.json`, JSON.stringify({ mode: FORCE_PENUH ? "penuh" : "turbo", totalSeconds: total, label: finalLabel }, null, 1));
console.log(`TOTAL: ${total} dtk (${FORCE_PENUH ? "RENDER PENUH" : "TURBO"})`);
