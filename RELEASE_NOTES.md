# KolosalCut v1.4.6

KECEPATAN v1.4.5 TETAP JALAN (terbukti di PC Anda 🚀) — dan BUG "MENTOK 99%" SUDAH DIBASMI. Laporan Anda: export & split kini cepat, TAPI progres berhenti di 99% dan "Batch selesai" tak kunjung muncul. Penyebabnya ketemu: ada **satu titik tunggu tanpa batas waktu di UJUNG pipeline**. Cukup SATU bagian yang menggantung di titik itu (biasanya bagian terakhir) — seluruh progres membeku di 99% selamanya.

## 1. PENYEBAB MENTOK 99%: SATU AWAIT TANPA BATAS WAKTU 🐞⏳

- Progres keseluruhan batch memang sengaja di-cap 99% selama masih ada pekerjaan — angka 100% + tulisan "Batch selesai" hanya ditulis SETELAH semua bagian benar-benar tamat (termasuk tahap terakhir: menyelesaikan encoder, merapikan berkas MP4, menutup file di disk).
- Masalahnya: tahap terakhir itu memakai `await` TANPA batas waktu. Bila encoder video Chromium mati diam-diam (error asinkron dari driver GPU), `flush()` bisa TIDAK PERNAH selesai. Antrean encode yang macet dan tulis disk yang tak kunjung selesai punya risiko yang sama.
- Akibatnya: semua bagian selesai cepat (99%), lalu SATU bagian menggantung selamanya di tahap pamungkas → progres beku, tombol/selesai tak pernah muncul. Persis yang Anda alami.

## 2. SEMUA TITIK RAWAN KINI DIJAGA BATAS WAKTU — BATCH PASTI TAMAT ⏱️🛡️

- **Menyelesaikan encoder** (flush): dijaga 90 detik (normalnya < 5 detik).
- **Menulis video ke disk & menutup berkas**: dijaga 180 / 120 detik.
- **Antrean encode video & audio**: dijaga 60 detik tanpa kemajuan.
- **Audio sunyi cover & encoder audio**: dijaga 30–60 detik.
- Bila salah satu lewat batas: bagian itu **gagal bersih** (file setengah jadi dibuang) lalu **otomatis diulang oleh mesin cadangan** yang sudah terbukti — batch LANJUT dan SELALU tamat. Tidak ada lagi beku selamanya.

## 3. ERROR ENCODER KINI TERTANGKAP — TIDAK ADA LAGI "MATI DIAM-DIAM" 🔎

- Dulu error encoder video hanya dicatat ke console — aplikasi terus menunggu sesuatu yang tak akan pernah datang.
- Kini error itu **langsung terdeteksi** di tengah render: bagian berhenti bersih dan diulang mesin cadangan, alasan kegagalan tampil di baris video.

## 4. PENJAGA ANTREAN (JARING PENGAMAN TERAKHIR) 🧷

- Tiap 30 detik, antrean memeriksa detak progres tiap bagian yang sedang dirender.
- Bagian yang **tanpa progres > 8 menit** dianggap macet: ditandai "macet — dihentikan ✗", dilepas dari antrean, dan batch **terus berjalan** ke bagian berikutnya.
- Dulu satu bagian yang menggantung membekukan seluruh batch; kini mustahil beku — paling banter satu bagian ditandai gagal dan bisa diulang lewat "LANJUTKAN" (bagian yang sudah jadi tidak dirender ulang).

## 5. PROGRES 100% TIDAK BISA DITIMPA BALIK 💯

- Perbaikan kecil: tick sisa dari bagian zombie tak bisa lagi menimpa progres 100% kembali ke 99% setelah "Batch selesai" tampil.

## CATATAN

- **Kecepatan tidak berubah sama sekali** — mesin Turbo v1.4.5 yang sudah terbukti cepat di PC Anda dipakai persis sama. Perbaikan ini murni menjamin batch SELALU tamat.
- Uji: tsc bersih di kode mesin, build desktop lulus, E2E lewat UI lulus — batch split 4 bagian + 1 file utuh, semuanya MP4 H.264 1080x1920 terverifikasi ffprobe, berakhir di "Batch selesai" progress=100%, badge mesin hidup.
