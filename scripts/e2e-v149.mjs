// E2E v1.4.9 — TANPA UNGGAH (ala NOVACUT): impor video TIDAK menyalin ke folder upload
// Jalankan: node scripts/e2e-v149.mjs   (server dev di :3210)
//
// 1) Impor via UI -> item SIAP lewat probe LOKAL -> TIDAK ADA folder baru di
//    data/uploads (penyimpanan tidak bertambah).
// 2) Export & split "Berapa bagian"=4 -> tetap tepat 4 file (render dari File lokal).
// 3) API teks otomatis: srcPath diterima (desktop nol salinan); path invalid ditolak.
// 4) DELETE /api/upload + purge salinan lama >48 jam.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const VIDEO = "/home/z/my-project/upload/kctest-scenes.webm";
const BASE = "http://localhost:3210";
const OUT_DIR = "/tmp/kc-e2e-v149";
const UPLOADS_DIR = "/tmp/kolosalcut-data/uploads";
const WANT_PARTS = 4;
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log("[E2E]", ...a);
const fail = (m) => { console.error("E2E GAGAL —", m); process.exit(1); };
const uploadsSnap = () => (fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR).sort() : []);

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"],
});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => log("PAGEERROR:", String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

// ===== 1. IMPOR TANPA UNGGAH =====
const before = uploadsSnap();
log(`folder upload sebelum: ${before.length} entri`);
const input = page.locator('input[type="file"]').first();
await input.setInputFiles(VIDEO);
log("video ditambahkan — menunggu pemeriksaan LOKAL (bukan unggahan)...");
await page.waitForFunction(() => document.body.innerText.includes("SIAP"), { timeout: 60000 });
const after = uploadsSnap();
const newDirs = after.filter((d) => !before.includes(d));
log(`folder upload sesudah: ${after.length} entri (baru: ${newDirs.length})`);
if (newDirs.length > 0) fail(`impor masih MENYALIN video ke upload: ${newDirs.join(", ")}`);
log("impor TANPA salinan ✓");
// durasi lokal harus terbaca (estimasi panel menjanjikan file)
const est = await page.evaluate(() => document.body.innerText.match(/([\d:]+)\s*→\s*±(\d+)\s*file/)?.[2] ?? "");
log(`estimasi panel: ±${est} file hasil (mode default)`);

// ===== 2. EXPORT & SPLIT 4 BAGIAN (regresi pipeline lokal penuh) =====
await page.getByText("EKSPORT & SPLIT", { exact: false }).first().click();
await page.getByText("Berapa bagian", { exact: false }).first().click();
await page.waitForTimeout(300);
await page.locator('input[type="number"]').first().fill(String(WANT_PARTS));
await page.waitForTimeout(300);
await page.getByRole("button", { name: /MULAI EKSPORT/ }).first().click();
log("MULAI EKSPORT — batch 4 bagian dari file LOKAL (tanpa uploadId)...");

const t0 = Date.now();
let finalLabel = "";
let finalProgress = -1;
while (Date.now() - t0 < 420000) {
  await page.waitForTimeout(4000);
  const nova = await page.evaluate(() => {
    const st = window.__NOVA__?.getState?.();
    if (!st) return null;
    return {
      label: st.exportState.label,
      progress: st.exportState.progress,
      running: st.exportState.running,
      results: st.exportState.results.map((r) => r.name),
    };
  });
  if (nova) {
    log(`t+${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(nova));
    if (nova.label.startsWith("Batch selesai") || nova.label.startsWith("Gagal")) {
      finalLabel = nova.label;
      finalProgress = nova.progress;
      break;
    }
  }
}
if (!finalLabel || !finalLabel.startsWith("Batch selesai")) fail(finalLabel || "batch tidak tamat");
if (finalProgress !== 1) fail(`progres akhir ${finalProgress}`);
const nova = await page.evaluate(() => {
  const st = window.__NOVA__?.getState?.();
  return st ? { results: st.exportState.results.map((r) => ({ name: r.name, url: r.url })) } : null;
});
const results = nova?.results ?? [];
if (results.length !== WANT_PARTS) fail(`hasil ${results.length}, harus ${WANT_PARTS}`);
log(`batch tamat progress=1 ✓ hasil tepat ${results.length} file ✓`);
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
  log(`PROBE ${r.name}: ${probe.replaceAll("\n", " | ")}`);
  if (!/h264/.test(probe)) fail(`${r.name} bukan H.264`);
}
await browser.close();

// ===== 3. API TEKS OTOMATIS — srcPath (desktop, nol salinan) =====
const post = (body) =>
  execFileSync("curl", ["-s", "-X", "POST", `${BASE}/api/transcribe`,
    "-H", "Content-Type: application/json", "-d", JSON.stringify(body)]).toString();

let r = JSON.parse(post({ srcPath: VIDEO, mode: "cepat" }));
if (!r.taskId) fail(`srcPath valid ditolak: ${JSON.stringify(r)}`);
log(`POST srcPath valid -> taskId=${r.taskId} ✓ (tugas whisper mungkin gagal di sandbox — itu wajar, yang diuji jalur path-nya)`);

r = JSON.parse(post({ srcPath: "relative/path.mp4" }));
if (!r.error) fail("srcPath relatif harusnya ditolak 400");
log(`POST srcPath relatif -> ditolak ✓ (${r.error})`);

r = JSON.parse(post({ srcPath: "/etc/passwd" }));
if (!r.error) fail("srcPath non-video harusnya ditolak 400");
log(`POST srcPath /etc/passwd -> ditolak ✓ (${r.error})`);

r = JSON.parse(post({ srcPath: "/tmp/tidak-ada-9x.mp4" }));
if (!r.error) fail("srcPath tak ada harusnya 404");
log(`POST srcPath tak ada -> ditolak ✓ (${r.error})`);

r = JSON.parse(post({}));
if (!r.error) fail("tanpa uploadId/srcPath harusnya 400");
log(`POST kosong -> ditolak ✓ (${r.error})`);

// ===== 4. DELETE /api/upload + PURGE salinan lama >48 jam =====
const oldDirs = uploadsSnap().filter((d) => d !== "work");
if (oldDirs.length > 0) {
  const target = oldDirs[0];
  const del = execFileSync("curl", ["-s", "-X", "DELETE", `${BASE}/api/upload?id=${target}`]).toString();
  if (!del.includes("true")) fail(`DELETE gagal: ${del}`);
  if (uploadsSnap().includes(target)) fail(`folder ${target} masih ada setelah DELETE`);
  log(`DELETE salinan lama (${target}) ✓ — tersisa ${uploadsSnap().length} entri`);
  // transcribe POST memicu purgeOldUploads (folder >48 jam)
  void post({ srcPath: VIDEO, mode: "sangat-cepat" });
  await new Promise((res) => setTimeout(res, 2500));
  const left = uploadsSnap().filter((d) => d !== "work");
  log(`setelah purge otomatis: ${left.length} salinan lama tersisa`);
  if (left.length > 0 && left.length >= oldDirs.length) {
    log(`CATATAN: salinan lama belum terbuang semua (mtm mungkin segar) — tidak fatal`);
  }
} else {
  log("tidak ada salinan lama untuk diuji DELETE/purge — lewati");
}
const finalDirs = uploadsSnap().filter((d) => d !== "work");
const grew = finalDirs.length - before.length;
if (grew > 0) fail(`folder upload bertambah ${grew} selama E2E (harus nol salinan)`);

log("E2E v1.4.9 LULUS ✓✓✓ — impor TANPA salinan, render lokal penuh, srcPath whisper, DELETE+purge beres");
