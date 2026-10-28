/**
 * Uji runtime server KolosalCut dari hasil paketan electron-builder.
 *
 * Mensimulasikan persis alur electron/main.js:
 *   1. Ekstrak resources/app-standalone.zip (adm-zip) ke folder sementara
 *   2. Spawn server.js memakai runtime Node milik Electron
 *      (ELECTRON_RUN_AS_NODE=1) — bukan Node biasa
 *   3. Curl sampai HTTP 200
 *
 * Dipakai di CI SEBELUM artefak dirilis. Kalau langkah ini gagal,
 * installer tidak akan pernah diterbitkan -> bug "gagal dimulai"
 * seperti v1.0.0/v1.1.0 tidak akan terulang.
 *
 * Pemakaian: node scripts/test-packaged-server.mjs
 *   env: PKG_DIR (opsional)  — mis. release/win-unpacked
 *        ELECTRON_BIN (opsional) — mis. node_modules/electron/dist/electron.exe
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const root = process.cwd();
const pkgDir = process.env.PKG_DIR
  ? path.resolve(process.env.PKG_DIR)
  : path.join(root, "release", process.platform === "win32" ? "win-unpacked" : "linux-unpacked");

const electronCandidates = [
  process.env.ELECTRON_BIN,
  path.join(root, "node_modules", "electron", "dist",
    process.platform === "win32" ? "electron.exe" : "electron"),
].filter(Boolean);

const electronBin = electronCandidates.find((p) => existsSync(p));
const zipPath = path.join(pkgDir, "resources", "app-standalone.zip");

function fail(msg) {
  console.error("GAGAL: " + msg);
  process.exit(1);
}

if (!electronBin) fail("Binary Electron tidak ditemukan (set ELECTRON_BIN).");
if (!existsSync(zipPath)) fail("app-standalone.zip tidak ada di paket: " + zipPath);

console.log("Paket    : " + pkgDir);
console.log("Electron : " + electronBin);

// 1) Ekstrak seperti yang dilakukan main.js
const runDir = mkdtempSync(path.join(tmpdir(), "kolosalcut-pkg-test-"));
const appDir = path.join(runDir, "app-standalone");
console.log("Ekstrak  : " + zipPath + " -> " + runDir);
try {
  new AdmZip(zipPath).extractAllTo(runDir, true);
} catch (e) {
  fail("ekstraksi zip gagal: " + e.message);
}
if (!existsSync(path.join(appDir, "server.js")))
  fail("server.js tidak ada setelah ekstraksi");
if (!existsSync(path.join(appDir, "node_modules", "next", "package.json")))
  fail("node_modules/next TIDAK ADA dalam zip — paket akan gagal MODULE_NOT_FOUND di mesin pengguna");
console.log("node_modules/next ada ✓");

// 2) Spawn dengan runtime Electron
const PORT = 3998;
const child = spawn(electronBin, [path.join(appDir, "server.js")], {
  cwd: appDir,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    KOLOSAL_DATA_DIR: runDir,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let errTail = "";
child.stdout.on("data", (d) => process.stdout.write("[srv] " + d));
child.stderr.on("data", (d) => {
  errTail = (errTail + d.toString()).slice(-3000);
  process.stdout.write("[srv:err] " + d);
});

const deadline = Date.now() + 90_000;
let ok = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(4000) });
    if (r.status === 200) {
      ok = true;
      break;
    }
    console.log("status " + r.status + " — menunggu 200…");
  } catch {
    /* belum siap */
  }
  await new Promise((r) => setTimeout(r, 1500));
}

child.kill();
try {
  rmSync(runDir, { recursive: true, force: true });
} catch {
  /* abaikan */
}

if (!ok) {
  console.error("--- stderr server (akhir) ---\n" + errTail);
  fail(`server hasil paketan tidak merespons 200 pada port ${PORT}`);
}
console.log("Server hasil PAKETAN merespons 200 via runtime Electron ✓✓✓");
