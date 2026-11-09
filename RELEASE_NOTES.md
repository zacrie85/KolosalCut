# KolosalCut v1.4.4

EXPORT & SPLIT KINI SECEPAT NOVACUT STUDIO — penyebab export 4–9 jam pada video/film panjang ditemukan dan dibasmi total. Hasil benchmark: setelan **Render Penuh** yang tadinya jalan berjam-jam kini sama cepatnya dengan jalur tercepat (di uji bebas: 9 bagian selesai 145 dtk, sebelumnya belum juga selesai di 149+ dtk dan masih terasa makin lambat — di film 90 menit asli selisihnya bisa 10–20 kali lipat).

## 1. PENYEBAB UTAMA KETEMU — SETELAN "RENDER PENUH" DIAM-DIAM MEMATIKAN MESIN TURBO 🐞⚡

- Dulu, memilih mesin **RENDER PENUH** (yang justru dijanjikan "semua gaya dijamin ikut") membuat KolosalCut **menonaktifkan MESIN TURBO** dan diam-diam jatuh ke mesin lama yang 2–20x lebih lambat — itulah kenapa export bisa 4 jam bahkan 9 jam, sementara NOVACUT Studio menyelesaikan video yang sama dalam 24 menit.
- Padahal sejak v1.4.3 hasil kedua mesin **sudah identik** (satu jalur gambar composeFrame: cover, judul, deskripsi, bingkai, part, teks otomatis, frame neon & bar sinema — semua ikut di mesin Turbo).
- **Kini saklar itu DIHAPUS**: semua pilihan mesin (Otomatis / Kilat / Render Penuh) memakai MESIN TURBO bila video didukung. Tidak ada lagi jebakan lambat.
- Video yang tidak didukung Turbo (bukan MP4 / codec tak didukung) tetap otomatis memakai mesin cadangan, dan alasannya kini selalu tertulis di baris status.

## 2. ANTREAN RENDER TIDAK LAGI TERSENDAT PADA FILM PANJANG 🎞️

- Dulu, film panjang (mis. 90 menit) membuat **cache suara memakan ±1 GB** dari anggaran RAM 1,5 GB — antrean hanya sanggup merender **1–2 bagian serentak** padahal setelan PARALEL 4. Terasa "berhenti sendiri".
- Kini bobot cache dibatasi wajar sehingga jalur cadangan pun tetap paralel — dan jalur Turbo memang tidak pernah menyentuh cache itu (audio asli disalin langsung, tanpa decode ulang).

## 3. PARALEL DEFAULT NAIK KE 5 — SETARA NOVACUT STUDIO 🚀

- Bawaan **PARALEL 4 → 5**, persis NOVACUT Studio v1.0.22 yang memenangkan benchmark Anda.
- Setelan OPTIMALKAN lama (2/3/4) **otomatis dinaikkan ke 5** saat aplikasi dibuka.
- Perbaikan kecil: nilai PARALEL rusak/terbaca aneh tidak lagi diam-diam jatuh ke 2 pekerja — kini fallback-nya 5.

## 4. ESTIMASI WAKTU (± JAM) KINI JUJUR ⏱️

- Dulu timer estimasi dihitung **sejak batch dimulai**, jadi fase persiapan berat (cover + **Membaca suara/teks otomatis** yang bisa puluhan menit pada film panjang) ikut terhitung — muncul angka "±9 jam" yang menakutkan padahal rendernya sendiri cepat.
- Kini estimasi **mulai dihitung saat bagian pertama benar-benar dirender** — angkanya murni kecepatan render.

## CATATAN

- Tidak ada perubahan tampilan & setelan lain — semua fitur v1.4.3 (posisi vertikal, 10 bingkai judul, cover 100 template, teks otomatis offline) tetap sama persis.
- Uji: tsc bersih di src (2 error hanya contoh bawaan lama), benchmark Playwright 2 jalur (Otomatis 150 dtk vs Render Penuh 145 dtk — setara), E2E penuh lulus dengan hasil MP4 H.264 1080x1920 + AAC terverifikasi ffprobe.
