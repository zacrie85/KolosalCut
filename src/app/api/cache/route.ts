// ============================================================
// KolosalCut v1.3.6 — API BERSIHKAN CACHE (ala NOVACUT Studio)
// Memindai & membersihkan sisa-sisa data olahan agar aplikasi
// kembali ramping seperti baru diinstall:
//  - uploads/  : video sumber yang pernah diunggah (sisa proses)
//  - exports/  : hasil render di FOLDER BAWAAN (opsional — boleh
//                dilewati bila pengguna masih menyimpan hasilnya)
//  - cache lain: cache Electron/Chromium (Cache, Code Cache,
//                GPUCache), file log, dan data sementara di folder
//                tmp sistem.
// AMAN: folder aplikasi (server-runtime) TIDAK PERNAH disentuh,
// dan pembersihan ditolak selagi ada video yang sedang dirender.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { UPLOADS_DIR, EXPORTS_DIR } from "@/lib/server/ffmpeg";
import { activeCount } from "@/lib/server/queue";

export const runtime = "nodejs";

async function dirStat(target: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  // v1.3.6 fix: target bisa berupa FILE langsung (mis. Cache/c1) — readdir pada
  // file melempar ENOTDIR sehingga ukurannya terhitung 0. Stat dulu, bila file
  // kembalikan ukurannya; bila folder, telusuri isinya.
  try {
    const st = await fs.stat(target);
    if (st.isFile()) return { bytes: st.size, files: 1 };
  } catch {
    return { bytes: 0, files: 0 }; // tidak ada — dianggap 0
  }
  const walk = async (d: string): Promise<void> => {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return; // folder belum ada / tak terbaca — dianggap 0
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        try {
          const st = await fs.stat(p);
          bytes += st.size;
          files++;
        } catch {
          /* file hilang saat pemindaian — abaikan */
        }
      }
    }
  };
  await walk(target);
  return { bytes, files };
}

/** hapus seluruh ISI folder (foldernya dipertahankan) */
async function clearDirChildren(dir: string): Promise<number> {
  let freed = 0;
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    const st = await dirStat(p).catch(() => ({ bytes: 0, files: 0 }));
    freed += st.bytes;
    await fs.rm(p, { recursive: true, force: true }).catch(() => undefined);
  }
  return freed;
}

async function fileSize(p: string): Promise<number> {
  try {
    const st = await fs.stat(p);
    return st.isFile() ? st.size : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const dataDir = process.env.KOLOSAL_DATA_DIR || path.join(os.tmpdir(), "kolosalcut-data");
  const isDesktop = Boolean(process.env.KOLOSAL_DATA_DIR);

  // cache Electron/Chromium hanya ada pada versi desktop (di userData)
  const caches = ["Cache", "Code Cache", "GPUCache"];
  let cacheBytes = 0;
  let cacheFiles = 0;
  for (const c of caches) {
    const st = await dirStat(path.join(dataDir, c));
    cacheBytes += st.bytes;
    cacheFiles += st.files;
  }

  // sisa data sementara di tmp sistem (mode web) — hanya bila berbeda dari dataDir
  const tmpData = path.join(os.tmpdir(), "kolosalcut-data");
  let tmpBytes = 0;
  let tmpFiles = 0;
  if (path.resolve(tmpData) !== path.resolve(dataDir)) {
    const st = await dirStat(tmpData);
    tmpBytes = st.bytes;
    tmpFiles = st.files;
  }

  const logPath = path.join(dataDir, "kolosalcut.log");
  const lastFfmpeg = path.join(os.tmpdir(), "kolosalcut-last-ffmpeg.txt");
  const logBytes = (await fileSize(logPath)) + (await fileSize(lastFfmpeg));

  const uploads = await dirStat(UPLOADS_DIR);
  const exportsSt = await dirStat(EXPORTS_DIR);

  return NextResponse.json({
    dataDir,
    isDesktop,
    busy: activeCount() > 0,
    uploads: { ...uploads, bytes: uploads.bytes + tmpBytes, files: uploads.files + tmpFiles },
    exports: exportsSt,
    caches: { bytes: cacheBytes + logBytes, files: cacheFiles },
    totalBytes: uploads.bytes + tmpBytes + exportsSt.bytes + cacheBytes + logBytes,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (activeCount() > 0) {
      return NextResponse.json(
        { error: "Masih ada video yang sedang dirender. Tunggu selesai atau batalkan dulu, lalu bersihkan cache." },
        { status: 409 }
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      uploads?: boolean;
      exports?: boolean;
      caches?: boolean;
    };

    const dataDir = process.env.KOLOSAL_DATA_DIR || path.join(os.tmpdir(), "kolosalcut-data");
    let freed = 0;

    if (body.uploads) {
      freed += await clearDirChildren(UPLOADS_DIR);
      // sisa data sementara di tmp sistem (bila bukan folder data utama)
      const tmpData = path.join(os.tmpdir(), "kolosalcut-data");
      if (path.resolve(tmpData) !== path.resolve(dataDir)) {
        freed += await clearDirChildren(tmpData);
      }
    }
    if (body.exports) {
      freed += await clearDirChildren(EXPORTS_DIR);
    }
    if (body.caches) {
      for (const c of ["Cache", "Code Cache", "GPUCache"]) {
        freed += await clearDirChildren(path.join(dataDir, c));
      }
      // log aplikasi & catatan ffmpeg terakhir
      for (const f of [path.join(dataDir, "kolosalcut.log"), path.join(os.tmpdir(), "kolosalcut-last-ffmpeg.txt")]) {
        freed += await fileSize(f);
        await fs.rm(f, { force: true }).catch(() => undefined);
      }
    }

    return NextResponse.json({ freedBytes: freed });
  } catch (e) {
    return NextResponse.json(
      { error: `Gagal membersihkan: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
