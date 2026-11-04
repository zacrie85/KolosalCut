# KolosalCut v1.4.1

**PERBAIKAN DARURAT** — v1.4.0 gagal dibuka di sebagian PC (jendela "A JavaScript error occurred in the main process: Identifier 'fs' has already been declared"). Versi ini memperbaikinya total — aplikasi kini terbuka normal dan seluruh kehebatan MESIN NOVACUT v1.4.0 siap dipakai.

## 1. Yang Diperbaiki

- **Aplikasi crash saat dibuka (DIPERBAIKI)** — ada dua deklarasi `fs` di mesin utama Electron (baris 20 dan 302); JavaScript menolak dan seluruh aplikasi mati sebelum jendela muncul. Deklarasi ganda dihapus, mesin utama kini lolos uji sintaks & uji jalan sungguhan.
- **Gerbang baru di pabrik build** — setiap rilis kini WAJIB lolos `node --check` (uji sintaks) untuk seluruh berkas Electron sebelum dipaketkan, ditambah uji server & gerbang whisper. Bug sekelas ini tidak akan pernah lolos terjual lagi.

## 2. Mesin NOVACUT Tetap Utuh (pewaris penuh v1.4.0)

Seluruh proses pengolahan video tetap memakai **MESIN NOVACUT STUDIO** — dari awal sampai akhir, tampilan KolosalCut tetap persis sama:

- **Encode akselerasi perangkat keras (WebCodecs H.264)** — hasil MP4 1080×1920 rapi, jauh lebih cepat dari FFmpeg lama.
- **MESIN TURBO** — video polos dipotong tanpa decode penuh + audio disalin utuh (stream-copy) — kilat.
- **Mesin Kilat offscreen** — komposisi kanvas tersembunyi laju adaptif hingga 16×, timestamp eksplisit: durasi & gerakan selalu presisi.
- **Antrean global per bagian (anggaran RAM ~1,5 GB)** — tidak pernah kehabisan memori & tidak pernah hang; film panjang tidak menyandera antrean.
- **Tulis langsung ke disk** — hasil mengalir ke folder pilihanmu sejak byte pertama.
- **Lanjutkan batch otomatis** — bagian yang sudah ada dilewati; BATALKAN per video & SEMUA tetap bekerja.
- **COVER 100 template, REKOMENDASI AI, 28 TRANSISI + 20 EFEK, ZOOM & GESER + ISI FRAME, frame neon & bar sinema, TEKS/label/deskripsi, teks otomatis whisper OFFLINE, kecepatan 0,25×–4×, ulang 1–10×** — semua digambar mesin asli NOVACUT.
- **OPTIMALKAN & BERSIHKAN CACHE** (dari v1.3.6) tetap ada di panel SISTEM & PERAWATAN.

## 3. Catatan Upgrade

- Punya v1.4.0 yang crash? **Langsung ganti ke 1.4.1** — tidak perlu uninstall, installer akan menimpa dengan rapi.
- Pengguna v1.3.6 ke bawah: instal langsung, semua setelan (folder hasil, kualitas, paralel, hasil OPTIMALKAN) tetap tersimpan.

---

**Diuji**: sintaks mesin utama lolos `node --check`, main process Electron dijalankan sungguhan hingga tahap jendela (tanpa crash), build Next.js standalone lulus penuh, dan E2E peramban nyata (render utuh + split 3 bagian → MP4 H.264 1080×1920 + cover + PART + frame neon terverifikasi).

**Download**: `KolosalCut-Setup-1.4.1.exe` (install) atau `KolosalCut-Portable-1.4.1.exe` (tanpa install).
