// v1.4.7 verification — SPLIT "Berapa bagian" vs "Durasi per video"
// Runs the REAL splitRanges() from src/lib/kc-engine/exporter.ts (pure fn).
// Node 24 strips TS types natively: extract fn verbatim -> temp .ts -> import.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const src = readFileSync(new URL("../src/lib/kc-engine/exporter.ts", import.meta.url), "utf8");
const m = src.match(/export function splitRanges\([\s\S]*?\n\}/);
if (!m) { console.error("splitRanges() not found in exporter.ts"); process.exit(1); }
const tmp = mkdtempSync(join(tmpdir(), "kc-split-"));
const tmpFile = join(tmp, "splitRanges.ts");
writeFileSync(tmpFile, m[0] + "\n");
const { splitRanges } = await import(tmpFile);

let fails = 0;
const ok = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) fails++; };

// ===== Skenario pengguna: film ±64 menit, pilih "Berapa bagian" = 30 =====
const dur64min = 64 * 60; // 3840 dtk
const parts30 = splitRanges(dur64min, "count", 30, 60);
ok(parts30.length === 30, `count mode: film 64 mnt + 30 bagian -> tepat 30 file (dapat ${parts30.length})`);
ok(parts30.every((r) => Math.abs(r.end - r.start - dur64min / 30) < 1e-9), "count mode: semua bagian sama panjang (128 dtk)");
ok(Math.abs(parts30[0].start) < 1e-9 && Math.abs(parts30[29].end - dur64min) < 1e-9, "count mode: rentang menutup 0..durasi penuh tanpa celah");

// ===== Mode "Durasi per video" TIDAK berubah =====
const durMode = splitRanges(dur64min, "duration", 30, 60);
ok(durMode.length === 64, `duration mode: film 64 mnt + 60 dtk -> 64 bagian (dapat ${durMode.length}) — perilaku lama utk mode durasi`);

// ===== Edge cases count mode =====
ok(splitRanges(100, "count", 1, 60).length === 1, "count mode: 1 bagian = 1 file utuh");
ok(splitRanges(100, "count", 50, 60).length === 50, "count mode: 50 bagian");
ok(splitRanges(100, "count", 99, 60).length === 50, "count mode: minta 99 -> dicatat maks 50 (clamp)");
ok(splitRanges(0, "count", 30, 60).length === 0, "count mode: durasi 0 -> tanpa bagian");
const odd = splitRanges(100, "count", 3, 60); // 33.33.. per bagian
ok(odd.length === 3 && Math.abs(odd[2].end - 100) < 1e-9, "count mode: durasi tak habis dibagi -> bagian terakhir menutup ke ujung");

console.log(fails === 0 ? "\nSEMUA TES LULUS ✓" : `\n${fails} TES GAGAL ✗`);
process.exit(fails === 0 ? 0 : 1);
