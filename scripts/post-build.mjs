// Menyalin aset statis ke dalam output standalone Next.js (cross-platform,
// pengganti `cp -r` agar build juga berjalan di Windows CI).
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.error(
    "Direktori .next/standalone tidak ditemukan — jalankan `next build` terlebih dahulu."
  );
  process.exit(1);
}

const jobs = [
  [path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static")],
  [path.join(root, "public"), path.join(standaloneDir, "public")],
];

for (const [src, dest] of jobs) {
  if (!existsSync(src)) continue;
  cpSync(src, dest, { recursive: true, force: true });
  console.log(`Disalin: ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}

console.log("Standalone siap dipakai (static + public tersalin).");
