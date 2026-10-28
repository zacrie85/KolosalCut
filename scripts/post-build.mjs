// Post-build Next.js standalone untuk KolosalCut Desktop.
//
// MASALAH YANG DIPERBAIKI (v1.1.1):
//   electron-builder MENG-SKIP folder `node_modules` saat menyalin extraResources —
//   juga saat diberi `filter` eksplisit. Akibatnya `require('next')` di server.js
//   gagal (MODULE_NOT_FOUND server.js:16) -> "KolosalCut gagal dimulai" di v1.0.0 & v1.1.0.
//
// SOLUSI:
//   Jangan pernah biarkan electron-builder menyalin pohon standalone.
//   1. Salin standalone hasil build ke staging bersih (whitelist — tanpa file
//      sampah tracing seperti Caddyfile/src/scripts dan tanpa .env).
//   2. Kemas staging menjadi SATU file: resources/app-standalone.zip (archiver).
//   3. electron-builder hanya menyalin 1 file zip (tanpa folder node_modules).
//   4. electron/main.js mengekstrak zip itu sendiri saat pertama kali dibuka
//      (marker versi -> ekstrak ulang saat versi berganti).
//
// Output:
//   .next/standalone        (utuh, dipakai smoke test pre-package)
//   resources/app-standalone.zip  (dibundel installer)
import { cpSync, existsSync, mkdirSync, rmSync, statSync, readdirSync, createWriteStream } from "node:fs";
import path from "node:path";
import archiver from "archiver";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const shipDir = path.join(root, ".next", "standalone-ship");
const zipPath = path.join(root, "resources", "app-standalone.zip");

if (!existsSync(standaloneDir)) {
  console.error(
    "Direktori .next/standalone tidak ditemukan — jalankan `next build` terlebih dahulu."
  );
  process.exit(1);
}

// ---------- 1) Salin aset statis ke dalam standalone (seperti sebelumnya) ----------
const staticJobs = [
  [path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static")],
  [path.join(root, "public"), path.join(standaloneDir, "public")],
];
for (const [src, dest] of staticJobs) {
  if (!existsSync(src)) continue;
  cpSync(src, dest, { recursive: true, force: true });
  console.log(`Disalin: ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}

// ---------- 2) Staging bersih (whitelist) ----------
const WHITELIST = ["server.js", "package.json", "node_modules", ".next", "public"];
rmSync(shipDir, { recursive: true, force: true });
mkdirSync(shipDir, { recursive: true });
for (const name of WHITELIST) {
  const src = path.join(standaloneDir, name);
  if (!existsSync(src)) continue;
  cpSync(src, path.join(shipDir, name), { recursive: true, force: true });
}
// Sanity check: pemeriksaan kritis sebelum dipaketkan
const nextPkg = path.join(shipDir, "node_modules", "next", "package.json");
if (!existsSync(nextPkg)) {
  console.error("FATAL: node_modules/next hilang dari standalone — build tidak valid.");
  process.exit(1);
}
if (!existsSync(path.join(shipDir, "server.js"))) {
  console.error("FATAL: server.js hilang dari standalone.");
  process.exit(1);
}
function dirSize(p) {
  let total = 0;
  for (const entry of readdirSync(p)) {
    const full = path.join(p, entry);
    const st = statSync(full);
    total += st.isDirectory() ? dirSize(full) : st.size;
  }
  return total;
}
console.log(
  `Staging bersih siap: ${path.relative(root, shipDir)} (${(
    dirSize(shipDir) / 1048576
  ).toFixed(1)} MB)`
);

// ---------- 3) Kemas menjadi satu zip ----------
mkdirSync(path.dirname(zipPath), { recursive: true });
rmSync(zipPath, { force: true });
await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolve);
  archive.on("error", reject);
  archive.on("warning", (err) => {
    if (err.code !== "ENOENT") reject(err);
  });
  archive.pipe(output);
  // Kemas di dalam folder "app-standalone/" agar ekstraksi langsung
  // menghasilkan <runtime>/app-standalone/server.js (sesuai electron/main.js)
  archive.directory(shipDir, "app-standalone");
  archive.finalize();
});
const zipMB = (statSync(zipPath).size / 1048576).toFixed(1);
console.log(`app-standalone.zip dibuat: ${path.relative(root, zipPath)} (${zipMB} MB)`);
console.log("Siap dipaketkan — electron-builder hanya perlu menyalin 1 file zip ini.");
