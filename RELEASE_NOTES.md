# KolosalCut v1.4.3

LIMA UPGRADE SEKALIGUS — disalin langsung dari NOVACUT Studio v1.0.22 (posisi vertikal teks + 10 bingkai judul) dan mesin export & split dipercepat lagi.

## 1. POSISI VERTIKAL — JUDUL DI BAWAH, PART DI ATAS, GESER BEBAS ⬍

- Tulisan **JUDUL + DESKRIPSI kini DEFAULT di PALING BAWAH** layar.
- Teks **PART / EPISODE / BAGIAN / EPS kini DEFAULT di PALING ATAS** layar.
- Keduanya **bisa digeser sampai ke ujung sebaliknya**: slider **POSISI VERTIKAL** baru di menu TEKS (bagian 05, Atas ↔ Bawah), atau langsung seret di kanvas pratinjau / pad posisi seperti biasa.
- **Di ujung slider tulisan tetap UTUH** — tepi blok (termasuk bingkainya) menempel rapi di tepi layar, tidak pernah terpotong.
- Layar cover TIDAK berubah — posisi judul & baris gabung di cover tetap seperti v1.4.2.

## 2. BINGKAI JUDUL — 10 GAYA, PILIH MANUAL (INTERIOR KOSONG) ▭

Menu TEKS bagian 06 memuat pemilih bingkai untuk tulisan judul di dalam video:

- **6 gaya sesuai gambar referensi**: Dinamis Miring (lapisan biru & pink), Merah Biru (bingkai merah + bar biru gradien), Berlian Biru (banner + ikon belah ketupat), Mewah Emas (garis emas ganda + manik), Emas Mahkota (bingkai emas + mahkota), Kartun Oranye (garis hitam tebal + bayangan oranye).
- **4 gaya futuristik buatan KolosalCut**: HUD Cyber (bracket cyan menyala), Neon Ungu (menyala + sirkuit samping), Panel Sci-Fi (nameplate teal), Tech Grid (garis putus-putus + kotak sudut).
- **BAGIAN DALAM BINGKAI KOSONG** — yang digambar hanya bagian luarnya, jadi video tetap terlihat di dalamnya dan tulisan judul duduk di atasnya.
- **Besar bingkai OTOMATIS mengikuti panjang & lebar tulisan** (diukur dari baris terlebar judul + deskripsi).
- Bisa juga **diatur manual**: slider Lebar & Tinggi (0.6x–2.5x) + tombol reset ke otomatis.
- Dipilih lewat **grid pratinjau WYSIWYG** — gambarannya memakai fungsi bingkai yang SAMA PERSIS dengan hasil export.

## 3. EXPORT & SPLIT LEBIH CEPAT LAGI ⚡

- **Paralel default naik 2x → 4x**: bagian-bagian kini dirender SERENTAK lebih banyak — video yang dipecah 4+ bagian selesai sampai 2x lebih cepat (target naik 75% terlampaui). Antrean berbasis anggaran RAM tetap menjaga memori agar tidak pernah hang.
- Pilihan paralel kini tersedia 1x / 2x / 3x / **4x** / 5x / 7x di panel EKSPORT & SPLIT.
- Setelan OPTIMALKAN lama yang masih 2x otomatis dinaikkan ke 4x (pengaturan lain tetap dihormati).
- **Bingkai judul diraster SEKALI saja** (raster cache) lalu ditempel ke tiap frame — ornamen menyala tidak dihitung ulang 30x per detik, jadi export dengan bingkai tetap secepat sebelumnya.
- Keunggulan v1.4.2 tetap: probe encoder 1080×1920 (High→Main→Baseline L4.0), encoder + decoder GPU penuh, anti-kedip.

## 4. PRATINJAU = HASIL (WYSIWYG)

- Kanvas pratinjau kini menggambar teks & bingkai lewat **jalur yang sama persis** dengan mesin render: posisi vertikal, bingkai, dan ukurannya di pratinjau = persis hasil export (mesin kilat & mesin Turbo identik).
- Posisi teks kini diukur dari **PUSAT blok** — seret pratinjau atau geser slider, hasilnya nyambung 1:1 dengan video jadi.

## 5. Fitur lama tetap utuh

Mesin NOVACUT Studio penuh (WebCodecs offscreen, MESIN TURBO stream-copy, antrean RAM-budget, tulis langsung ke disk, lanjutkan batch, BATALKAN), 100 template cover + bingkai cover 3 gaya, 28 transisi + 20 efek, zoom & geser + ISI FRAME, frame neon + bar sinema, teks otomatis whisper OFFLINE, OPTIMALKAN & BERSIHKAN CACHE, gaya cover NOVACUT.

---

**Diuji menyeluruh**: TypeScript bersih di src, build produksi lulus penuh, 10 bingkai + 8 kasus posisi (default bawah/atas, ujung slider utuh, bingkai ikut teks, skala manual 1.8x / 0.7x-1.4x) diverifikasi lewat render Playwright pada jalur `drawTextOverlay` asli; kode BINGKAI JUDUL & POSISI VERTIKAL terverifikasi ada di bundle hasil build.

**Download**: `KolosalCut-Setup-1.4.3.exe` (install) atau `KolosalCut-Portable-1.4.3.exe` (tanpa install).
