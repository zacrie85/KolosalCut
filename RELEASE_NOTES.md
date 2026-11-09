# KolosalCut v1.4.7

LAPORAN ANDA: "pilih **berapa bagian** isi 30, tapi hasilnya **64 video** bukan 30." BENAR — itu bug serius, dan sudah DIBASMI di versi ini. Angka yang Anda pilih kini **DIHORMATI 100%**: pilih 30 = tepat 30 file. Pilih 10 = tepat 10 file. Tidak ada lagi jumlah yang "jadi sendiri".

## 1. PENYEBAB: PILIHAN "BERAPA BAGIAN" DIABAIKAN MESIN 🐞

- Menu EKSPORT & SPLIT punya 2 pilihan: **"Berapa bagian"** (mis. 30) dan **"Durasi per video"** (mis. 60 detik). Ternyata sejak v1.4.0, saat perintah diteruskan ke mesin render, **jenis pilihannya tidak ikut dikirim** — mesin selalu disuruh memotong **per durasi**.
- Akibatnya angka 30 yang Anda isi hanya dipakai untuk tulisan label, sedangkan pemotongan nyata memakai durasi potong bawaan (60 detik/bagian) → film ±64 menit terpotong **64 video**. Persis yang Anda alami: "Bagian 8/64", "PART 10/64".
- Rumusnya kebetulan cocok untuk mode durasi, jadi bug ini lolos dari semua tes sebelumnya (tes lalu memakai mode durasi, bukan mode jumlah bagian).

## 2. PERBAIKAN: JENIS PEMOTONGAN SEKARANG IKUT TERKIRIM ✅

- Pilihan Anda kini diteruskan utuh ke mesin:
  - **"Berapa bagian"** → mesin membagi video **rata menjadi TEPAT N file** (30 = 30 file; tiap bagian sama panjang, isi terakhir tetap utuh sampai frame penutup).
  - **"Durasi per video"** → mesin memotong **tiap N detik** (perilaku lama, tidak berubah).
- Total label ikut benar: video ke-30 tampil "PART 30/30" / "Bagian 30/30", nama file `...-part-30-30.mp4`.
- Berlaku di KEDUA jalur render (mesin Turbo/Kilat maupun jalur cadangan) karena keduanya membaca setelan yang sama.

## 3. BONUS: ESTIMASI PANEL TIDAK LAGI "MENGHILANG" SAAT MERENDER 📊

- Dulu, saat proses export & split berjalan, baris estimasi di panel menyusut jadi **"0:00 → ±0 file"** — padahal batch sedang jalan. Sekarang estimasi tetap tampil ("±30 file hasil") selama proses berlangsung dan setelah selesai, jadi Anda selalu tahu rencana pembagian yang sedang/akan dikerjakan.

## CATATAN

- **Kecepatan tidak berubah** — mesin Turbo v1.4.5 + jagaan anti-mentok-99% v1.4.6 tetap dipakai persis sama; perbaikan ini murni soal JUMLAH file hasil.
- Uji: tes logika 9 kasus lulus (mode bagian 30 → tepat 30 rentang; mode durasi 60 dtk pada film 64 mnt → 64 bagian, persis skenario bug Anda) + E2E lewat UI sungguhan: video 12 detik + "Berapa bagian"=4 → **tepat 4 file MP4** H.264 1080x1920 (ffprobe), isi 4×3 dtk = utuh tanpa hilang, batch tamat "Batch selesai" progress=100%. Mode "Durasi per video" diuji ulang → tetap benar.
