# KolosalCut v1.4.9

LAPORAN ANDA: "saat mau mengolah video, aplikasi mengunggah/salin videonya dulu ke folder upload-nya sendiri — itu mengisi penuh penyimpanan. Boleh tidak seperti NOVACUT, langsung tanpa diunggah?" BISA — dan versi inilah jawabannya: **TANPA UNGGAH**. Mulai sekarang video Anda **TIDAK DISALIN LAGI** ke folder data aplikasi. Penyimpanan tidak bertambah sama sekali saat mengimpor.

## 1. SEBELUMNYA UNTUK APA UNGGAH ITU? 🤔

- Itu warisan mesin lama (sebelum v1.4.0), ketika video benar-benar diproses di server internal aplikasi — videonya memang harus tersalin dulu.
- Sejak mesin NOVACUT pindah ke aplikasi (render langsung dari file Anda), salinan itu tinggal dipakai SATU hal saja: fitur TEKS OTOMATIS (subtitle AI). Jadi video 1–10 GB disalin utuh hanya demi subtitle — boros sekali. Maaf, kawan!

## 2. SEKARANG: LANGSUNG DARI FILE ANDA (PERSIS NOVACUT) ✅

- **Impor**: info video (durasi, resolusi, ada audio/tidak) diperiksa **langsung dari file Anda** di tempatnya — tanpa menyalin apa pun. Status "MENGUNGGAH" berganti jadi "MEMERIKSA" (hitungan detik).
- **Render & split**: memakai file lokal Anda langsung (memang sudah begitu sejak v1.4.0 — kini konsisten sampai ke impor).
- **Teks otomatis (subtitle AI)**: di aplikasi desktop, whisper membaca video **langsung dari lokasi aslinya** (path asli) — **NOL salinan**.
- **Mode browser** (buka via web browser biasa, bukan aplikasi): browser tidak boleh tahu path file, jadi salinan dibuat **hanya saat TEKS OTOMATIS dipakai**, dan **otomatis DIHAPUS** begitu subtitle selesai. Tidak ada lagi tumpukan.

## 3. BONUS: BERSIH-BERSIH SALINAN LAMA 🧹

- Salinan-salinan lama dari versi sebelumnya (folder data aplikasi → `uploads`) yang sudah **lebih dari 48 jam** otomatis dibuang saat aplikasi dipakai — folder data menyusut sendiri kembali.
- Bisa juga bersihkan manual kapan pun lewat menu SISTEM → **BERSIHKAN CACHE** (pilih folder uploads).

## CATATAN

- Kecepatan, mesin Turbo/Kilat, anti-mentok-99%, anti-kedip: **semua tetap persis sama**.
- Uji: E2E khusus — impor lewat UI → **0 folder baru** di folder upload (dibuktikan daftar folder sebelum/sesudah) → export & split "Berapa bagian"=4 dari file lokal → **tepat 4 file MP4 H.264** → API teks otomatis menerima path asli & menolak path tidak valid (relatif, non-video, tidak ada) → DELETE salinan sementara ✓ → salinan lama ≥48 jam otomatis terbuang ✓. Regresi E2E anti-kedip v1.4.8: lulus semua. tsc bersih, build desktop lulus.
