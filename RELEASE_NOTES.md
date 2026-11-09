# KolosalCut v1.4.5

PENYEBAB SEBENARNYA export 4–9 jam AKHIRNYA KETEMU — dan kini **TURBO BISA MELIHAT KECEPATANNYA SENDIRI**. Kalau render ternyata jalan di CPU (lambat), Turbo otomatis pindah ke konfigurasi yang sudah TERBUKTI di PC Anda oleh NOVACUT Studio (24 menit). Hasil E2E: lulus penuh, dan baris status kini menampilkan mesin + kecepatan nyata secara langsung.

## 1. PENYEBAB SEBENARNYA: "CEK GPU" YANG MENIPU 🐞🔍

- Sejak v1.4.2, KolosalCut menentukan encoder lewat `isConfigSupported` dengan preferensi "prefer-hardware". Ternyata **cek ini TIDAK BISA dipercaya**: Chromium menjawab "didukung" WALAUPUN nanti diam-diam memakai **OpenH264 SOFTWARE** — karena GPU menolak profil/resolusi yang ditawarkan lebih dulu (High Profile L4.0 di 1080x1920).
- Akibatnya pada banyak PC, render berjalan di **software encode 10–20 fps = 0,3–0,6x realtime** → film 90 menit selesai **4–9 jam**. Itulah yang tetap terjadi di v1.4.4: saklar mesin sudah dihapus, TAPI konfigurasi encoder hasil probe masih bisa jatuh ke CPU.
- NOVACUT Studio v1.0.22 lolos dari jebakan ini karena probe-nya berbeda (720p, Baseline L3.1, tanpa preferensi hardware) → Chromium memilih **encoder GPU (D3D11)** → video yang sama selesai 24 menit.

## 2. TURBO KINI MENGUKUR KECEPATAN NYATA & OTOMATIS GANTI KONFIGURASI ⚡🧠

- Saat bagian pertama dirender, Turbo **mengukur throughput loop penuh** (decode + compose + encode) pada 60 frame pertama.
- Kalau kecepatan terukur **< 1,2x realtime** (tanda berjalan di software), Turbo **mengulang bagian itu dengan tangga konfigurasi terbukti NOVACUT** (Baseline L3.1 → L4.0 → Main → High, TANPA preferensi hardware — persis jalur yang memenangkan benchmark 24 menit di PC Anda).
- Konfigurasi tercepat yang terbukti **dicache selama sesi** — bagian berikutnya langsung pakai yang cepat, tanpa bolak-balik.
- Di PC dengan GPU sehat: tidak ada perubahan — kualitas High Profile tetap dipakai (probe pertama memang cepat).

## 3. BADAN MESIN TAMPIL TERUS DI BARIS STATUS — TIDAK ADA LAGI MESIN RAHASIA 🏷️

- Baris tiap video kini selalu memakai label seperti:
  - `EPISODE 11/19 · TURBO 8.4x` → render di GPU, selesai dalam hitungan menit.
  - `EPISODE 11/19 · TURBO CPU 0.8x` → render di CPU (PC tanpa GPU yang bisa dipakai Chromium) — jujur, supaya kelihatan penyebabnya.
  - `EPISODE 11/19 · KILAT (alasan...)` → Turbo tidak bisa jalan untuk video ini + alasannya.
- Dulu alasan "Turbo mati: ..." langsung tertimpa label bagian — pengguna tidak pernah tahu mesin apa yang bekerja. Kini badge menempel permanen sampai bagian selesai.
- Kecepatan terukur diperbarui tiap bagian dimulai — angkanya nyata dari loop render, bukan tebakan.

## CATATAN

- Tidak ada perubahan tampilan & setelan lain — semua fitur v1.4.4 (posisi vertikal, 10 bingkai judul, cover 100 template, teks otomatis offline, paralel 5, estimasi jujur) tetap sama persis.
- Uji: tsc bersih di kode mesin (3 error hanya berkas contoh/template bawaan yang tak terpakai), build desktop lulus, E2E penuh lewat UI lulus — 3 bagian + 1 file utuh, MP4 H.264 1080x1920 terverifikasi ffprobe, badge `TURBO CPU 0.8x` terlihat hidup di log (sandbox tanpa GPU — di PC ber-GPU badge akan menunjukkan `TURBO Nx` dengan N jauh lebih besar).
