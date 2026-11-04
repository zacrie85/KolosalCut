# KolosalCut v1.4.0

UPGRADE TERBESAR DALAM SEJARAH KOLOSALCUT! Seluruh mesin pengolahan video diganti total dengan **MESIN NOVACUT STUDIO** — dari awal sampai akhir. Tampilan KolosalCut tetap persis seperti yang kamu kenal, tetapi di baliknya kini bekerja mesin render kelas editor profesional: **WebCodecs offscreen + antrean global per bagian + tulis langsung ke disk**.

## 1. Mesin Render Baru: NOVACUT (WebCodecs) ⚡⚡⚡

Seluruh proses FFmpeg lama dihapus dan digantikan mesin yang sama dengan NOVACUT Studio:

- **Encode akselerasi perangkat keras** — video di-encode lewat WebCodecs (H.264) yang memakai akselerasi GPU/hardware PC-mu, bukan murni CPU. Hasil: MP4 H.264 1080×1920 yang sama bagusnya, jauh lebih cepat.
- **MESIN TURBO** — video polos dipotong tanpa decode penuh: frame diambil langsung dari data asli MP4 + **audio disalin utuh tanpa di-encode** (stream-copy ala NOVACUT). Ini penerus MESIN KILAT — lebih cepat dan hemat RAM.
- **Mesin Kilat (offscreen)** — bila Turbo tak tersedia untuk suatu video, mesin kilat offscreen mengambil alih: video TIDAK diputar, frame dikomposisi ke kanvas tersembunyi secepat mungkin (laju adaptif hingga 16×) dengan timestamp eksplisit — durasi & gerakan selalu presisi.
- **Antrean global per bagian** — semua bagian dari semua video masuk SATU antrean kerja cerdas: pekerja menarik tugas selama anggaran RAM masih cukup (maks ~1,5 GB), jadi tidak pernah kehabisan memori & tidak pernah hang. Film panjang tidak lagi menyandera antrean.
- **Tulis langsung ke disk** — hasil render mengalir ke folder pilihanmu begitu ada byte pertama (file ratusan MB tidak pernah menumpuk di memori).
- **Lanjutkan batch** — bagian yang filenya sudah ada di folder hasil otomatis dilewati. Batch terputus listrik? Buka lagi, lanjut dari yang terakhir.
- **Bisa dibatalkan** — tombol BATALKAN per video & BATALKAN SEMUA tetap ada dan kini bekerja di mesin baru.

## 2. Semua Fitur KolosalCut Tetap Utuh — Kini Digambar Mesin NOVACUT

- **COVER 100 template ala NOVACUT** — kini digambar langsung oleh mesin NOVACUT asli (bukan konversi PNG): template populer, REKOMENDASI AI, bingkai klasik/modern/futuristik, latar adegan (tiap bagian beda/sama) atau hitam, unggahan sendiri.
- **28 TRANSISI + 20 EFEK blockbuster** — dirender kanvas NOVACUT asli (Flash Snap, Whip Pan, RGB Glitch, Teal & Orange, VHS, dsb.) dengan tampilan yang sama seperti di NOVACUT Studio.
- **ZOOM & GESER 4 arah + ISI FRAME** — zoom 1–5×, pad panah, X/Y % — digabung otomatis dengan zoom isi-frame untuk mode 9:16 penuh.
- **Frame neon & minimalis + bar sinema** — Neon Emas/Ganda/Pelangi (animasi) dan Minimal Putih/Emas/Sudut/Garis kini digambar real-time di atas hasil.
- **TEKS judul/label/deskripsi** — posisi, ukuran & font pilihanmu dipetakan ke mesin teks NOVACUT (word-wrap + auto-shrink bawaan: teks panjang otomatis rapi).
- **Label kustom** — template "BAGIAN KE-{n}" dan teman-temannya tetap didukung, termasuk penamaan file hasil.
- **Teks otomatis (suara → teks)** — tetap 100% OFFLINE dengan whisper-cli bawaan + model suara di aplikasi; gaya TikTok/Klasik/Karaoke dan slider posisi tetap berfungsi, kini dibakar lewat mesin teks NOVACUT.
- **Kecepatan 0,25×–4× & ulang 1–10×** — sinkron penuh dengan teks otomatis.
- **Kualitas**: Ringan (4,5 Mbps) / Seimbang (9 Mbps) / Tinggi (14 Mbps) — resolusi selalu penuh 1080×1920.

## 3. Lebih Hemat & Lebih Pintar

- Audio didekode sekali per film (mono mixdown) dan dipakai ulang semua bagian — RAM hemat ±50%.
- Pembaruan UI dibatasi ~3×/detik — badai render ulang penyebab "aplikasi beku" dihapus dari akarnya.
- Elemen video dibersihkan otomatis tiap film selesai — dekoder tidak menumpuk.
- Estimasi waktu tersisa memakai bobot per film (film 2 jam beratnya lebih besar daripada video 1 bagian).

## 4. Perawatan (dari v1.3.6, ikut dalam paket ini)

- Tombol **OPTIMALKAN** — baca CPU/RAM/GPU PC-mu, atur otomatis paralel + kualitas + thread.
- Tombol **BERSIHKAN CACHE** — pindai & bersihkan sisa data olahan, aplikasi kembali ramping.

---

**Diuji menyeluruh (E2E nyata di peramban sungguhan)**: tambah video → unggah → MULAI EKSPORT → hasil MP4 H.264 1080×1920 terverifikasi (1 file utuh 14 dtk = cover 2 dtk + isi 12 dtk; dan 3 bagian split @4 dtk dengan cover masing-masing, teks PART & frame neon tergambar sempurna). Tetap 100% offline, tanpa internet, tanpa watermark.

**Download**: `KolosalCut-Setup-1.4.0.exe` (install) atau `KolosalCut-Portable-1.4.0.exe` (tanpa install).
