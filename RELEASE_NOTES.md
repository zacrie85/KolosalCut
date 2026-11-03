# KolosalCut v1.3.5

Rilis terbesar KolosalCut! Panel pengaturan kini punya **5 MENU UTAMA**: **VIDEO, TEKS, GAYA, EFEK, COVER** — membawa **seluruh gaya COVER**, **seluruh EFEK**, **ZOOM & GESER bebas 4 arah**, dan **menu EKSPORT & SPLIT baru** ala NOVACUT Studio — jauh lebih cepat, tidak hang, dan bisa dibatalkan.

## 1. Menu COVER Baru — Cover Studio ala NOVACUT (100 Template!)

Menu cover lama digantikan penuh dengan **Cover Studio**:

- **100 template cover** = 10 layout × 10 palet warna: *Impact Center, Lower Third, Top Banner, Gradient Side, Boxed Title, Neon Glow, Cinematic Bars, Sticker Badge, Outline Raksasa, Diagonal Band* × palet *Cyber Neon, Sunset Fire, Gold Luxury, Ice Cool, Toxic Green, Royal Purple, Blood Red, Monochrome, Candy Pop, Ocean Deep*.
- **REKOMENDASI AI** — 6 template paling cocok dipilih otomatis dari judul & kecerahan frame video.
- **SEMUA TEMPLATE (100)** — buka galeri miniatur untuk melihat 100 gaya sekaligus dengan judul videomu sendiri.
- **Sumber cover**: *Otomatis dari Video* (adegan terbaik dari tiap bagian) atau *Unggah Sendiri* (PNG/JPG, bisa "gambar apa adanya" tanpa teks).
- **Latar cover**: *Adegan dari Video* dengan pilihan **Tiap Bagian Beda / Semua Bagian Sama**, atau *Hitam Polos* gaya trailer klasik.
- **Bingkai cover transparan 75%**: *Klasik* (emas vintage), *Modern* (minimalis), *Futuristik* (sudut HUD menyala), atau tanpa bingkai.
- **Pratinjau cover langsung** di dalam panel — persis seperti hasil render.
- Judul & label PART otomatis tertata sesuai gaya template yang dipilih.
- Masih suka cover lama? Pilih **"Klasik KolosalCut (teks judul sederhana)"**.

## 2. Menu EFEK Baru — 28 Transisi + 20 Efek Blockbuster ala NOVACUT

- **TRANSISI MASUK TIAP BAGIAN (28)** dalam 4 kategori:
  - *Trailer Hollywood*: Flash Snap, Whip Pan, Zoom Punch, Zoom Blast, RGB Glitch, Impact Shake, Cinematic Bars, Film Burn
  - *Iklan Produk*: Slide 4 arah, Push Parallax, Diagonal Wipe, Iris Circle, Window Blinds, Split Reveal, Bounce Pop, Flare Sweep
  - *Sinematik*: Cross Dissolve, Dip ke Hitam/Putih, Blur Dissolve
  - *Trend Viral*: Spin Swap, Pixelate, TV Static, Chromatic Slide, Mosaic Reveal
  - Slider durasi transisi 0.2–2 detik.
- **EFEK BLOCKBUSTER (20)** — bisa dipadukan bebas:
  - *Color Grading (8)*: Teal & Orange, Bleach Bypass, Noir, Vintage Film, VHS Retro, Cyberpunk Neon, Golden Hour, Thriller Dingin
  - *Efek Visual (12)*: Bar Sinematik, Vignette, Film Grain, Bloom Glow, Lens Flare, RGB Split, Scanline CRT, Handheld Shake, Beat Pulse, Slow Zoom (Ken Burns), Ghost Trail, Spotlight
- **KECEPATAN & ULANG**: slow-motion 0.25× sampai time-lapse 4×, dan ulang potongan sampai 10× — teks otomatis & efek tetap sinkron.
- Semua efek tampil **live di monitor pratinjau**, dan diterapkan ke **setiap bagian** hasil render.

## 3. Menu VIDEO — ZOOM & GESER Bebas 4 Arah (ala NOVACUT)

- Zoom diperluas **1–5×** (sebelumnya maks 2.5×).
- **Pad panah 4 arah** untuk menggeser area gambar: kiri–kanan **dan** atas–bawah, dengan pembacaan **X/Y %** langsung.
- Tombol **ISI FRAME** — menghitung zoom otomatis sampai bar hitam hilang (mode 9:16 Biasa).
- Tombol **RESET** — kembali ke tengah & zoom 1×.

## 4. Menu EKSPORT & SPLIT Baru — ala NOVACUT (Kilat ⚡ · Anti-Hang · Bisa Dibatalkan)

Seluruh menu ekspor & split lama digantikan satu panel ala NOVACUT Studio, mengurus segalanya dari pembagian sampai hasil:

- **EKSPORT SAJA / EKSPORT & SPLIT** — pilih tiap video jadi 1 file utuh, atau pecah otomatis jadi banyak video (*Berapa bagian* / *Durasi per video*) lengkap dengan estimasi **`01:10 → ±3 file hasil`**.
- **MESIN KILAT ⚡** — video polos (tanpa cover/efek/teks) dipotong **tanpa render ulang**: 3 bagian dari video 70 detik selesai dalam ±1 detik (uji internal: 1 dtk vs 65 dtk render penuh — **puluhan kali lebih cepat**). Pilihan mesin: *Otomatis* (disarankan), *Kilat ⚡*, atau *Render Penuh*; bila ada gaya aktif, mesin otomatis beralih ke render penuh agar gaya tidak hilang (ada pemberitahuannya).
- **ANTI-HANG** — mesin render kini punya penjaga: ffmpeg yang macet (tidak ada progres 90 detik) dihentikan otomatis dengan pesan yang jelas, bukan menggantung selamanya. Peluncuran video paralel diberi jeda singkat supaya RAM tidak tiba-tiba memuncak.
- **BATALKAN** — tombol ❌ per video & **BATALKAN SEMUA**: render berhenti seketika (proses ffmpeg dibunuh) dan bagian yang sudah selesai tetap tersimpan.
- **Estimasi waktu tersisa** di bar progres keseluruhan, plus progres per video ala batch NOVACUT.
- Kualitas render, proses paralel (1–7×), dan folder hasil kini ikut di menu ini.
- Hasil render penuh tetap identik: cover, frame neon, efek, teks, teks otomatis — semua gaya dijamin ikut (bagian mesin Kilat hanya dipakai saat memang tidak ada gaya).

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh & install **`KolosalCut-Setup-1.3.5.exe`** (di bawah).
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Buka aplikasi — pastikan header tertulis **v1.3.5**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.3.5.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.3.5.exe` | Versi portabel tanpa instalasi |

---

# KolosalCut v1.3.4

Fitur baru pada **Teks Otomatis**: **slider POSISI TEKS** — naikkan atau turunkan posisi teks subtitle di video sesuka hatimu.

## Baru: Slider Posisi Teks (▲ ATAS ↔ BAWAH ▼)

- Sebelumnya teks otomatis selalu tampil di tengah layar dan tidak bisa dipindah.
- Kini ada slider **"Posisi Teks"** di menu **10 Teks Otomatis** (muncul saat teks otomatis diaktifkan):
  - Geser ke **▲ ATAS** → teks naik ke arah atas layar
  - Geser ke **▼ BAWAH** → teks turun mendekati dasar layar
  - Angka persen ditampilkan langsung (0–100%)
- Berlaku untuk **ketiga gaya** (Klasik, TikTok, Karaoke) — posisi yang kamu pilih dipakai semua bagian video.
- Posisi bawaan kini **75%** — zona subtitle khas reels, tidak lagi pas di tengah.
- Setelan posisi ikut terbawa oleh **TERAPKAN SETELAN KE SEMUA**.
- Posisi dibatasi 5–95% agar teks tidak pernah terpotong keluar layar.

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh & install **`KolosalCut-Setup-1.3.4.exe`** (di bawah).
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Buka aplikasi — pastikan header tertulis **v1.3.4**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.3.4.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.3.4.exe` | Versi portabel tanpa instalasi |

---

# KolosalCut v1.3.3

Fitur baru besar: **TEKS OTOMATIS (SUARA → TEKS)** — setiap ucapan di video otomatis menjadi teks yang menempel pas dengan suaranya, seperti caption TikTok. Berjalan **100% offline** di PC-mu (tanpa internet), difokuskan untuk **Bahasa Indonesia (resmi & slang)**.

## Baru: Teks Otomatis dari Suara (Whisper Offline)

- Buka menu **10 Teks Otomatis (Suara → Teks)** → nyalakan **"Buat teks dari suara video ini"** → proses seperti biasa. Setiap bagian hasil kini punya teks yang **muncul TEPAT bersamaan dengan suaranya**.
- **Dipilih manual per video** — video yang teksnya tidak diinginkan cukup biarkan mati (tanpa lencana TEKS di daftar). Tombol **TERAPKAN SETELAN KE SEMUA** ikut menyebarkan pilihan ini ke semua video.
- **Tiga pilihan kecepatan membaca suara:**
  | Pilihan | Cocok untuk |
  |---|---|
  | **SANGAT CEPAT** | Paling kilat, suara sangat jelas, akurasi dasar |
  | **CEPAT** (disarankan) | Hasil cepat, rata-rata bagus, cocok untuk video jelas |
  | **AKURAT** | Lebih teliti untuk audio berisik / banyak istilah, agak lama |
- **Tiga gaya tampilan teks:** KLASIK (teks putih di bawah seperti film), TIKTOK (teks besar rata tengah dengan latar gelap — bawaan), dan KARAOKE (kata yang sedang diucapkan menyala emas satu per satu!).
- **Video panjang tidak dua kali kerja** — film 2 jam dibaca suaranya **sekali saja** (~20–40 menit di belakang layar dengan mode CEPAT), lalu semua bagian otomatis menerima teksnya masing-masing sesuai rentang waktunya.
- **Progres transparan** — saat aplikasi sedang membaca suara, status tampil jelas: *"Membaca suara (teks otomatis)..."* dengan persentase, lalu lanjut merender seperti biasa.
- Video tanpa suara (musik saja / senyap) otomatis dilewati tanpa error. Aplikasi tetap berjalan offline penuh — mesin dan model suara sudah tertanam di dalam installer.

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh & install **`KolosalCut-Setup-1.3.3.exe`** (di bawah).
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Buka aplikasi — pastikan header tertulis **v1.3.3**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.3.3.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.3.3.exe` | Versi portabel tanpa instalasi |

---

# KolosalCut v1.3.2

Perbaikan render: **judul video kini selalu tampil di cover** (tidak ada lagi cover yang hanya bertuliskan "PART 1"), teks judul panjang kini terbungkus rapi persis seperti pratinjau, dan durasi hasil kini **persis sesuai setelan** (tidak ada lagi 2 detik ekstra membeku di ujung tiap bagian). Ditambah: **render antrean kini default hanya 2 video serentak** agar PC tidak tersiksa saat mengantre puluhan video.

## Perbaikan 1: Judul Tampil Selalu di Cover

- Sebelumnya, bila teks judul kosong saat render, cover tampil **tanpa judul sama sekali** — hanya label "PART 1". Kini judul kosong otomatis diisi dari **nama file video**, jadi cover selalu punya judul.
- Toggle "Tampilkan judul" tetap dihormati — bila dimatikan, memang tanpa judul.

## Perbaikan 2: Bungkus Teks Sama Persis dengan Pratinjau

- Sebelumnya pratinjau menampilkan judul panjang terbungkus beberapa baris rata tengah, tetapi hasil render menggambarnya **satu baris super panjang** melintang layar. Keduanya kini memakai aturan bungkus yang sama (maks. 6 baris, rata tengah) — apa yang terlihat di pratinjau = apa yang jadi di video.

## Perbaikan 3: Durasi Hasil Persis Sesuai Setelan

- Sebelumnya tiap bagian hasil **lebih panjang 2 detik** dari seharusnya: cover membeku 1 detik ekstra di akhir, dan isi video membeku 1 detik ekstra di ujung (contoh: setelan cover 2 dtk + potongan 60 dtk menghasilkan file 64 dtk). Penyebabnya filter overlay yang memperpanjang durasi output mengikuti input overlay yang sengaja dibuat lebih panjang.
- Kini cover berhenti persis di durasi cover dan tiap bagian berhenti persis di titik potong — penjumlahan durasi semua bagian = durasi video sumber + cover.
- Bonus: indikator progres render kini berjalan mulus sampai 100% tanpa "menggantung" di akhir.

## Baru: Batas Render 2 Video Serentak (Default)

- Sebelumnya setelan "Proses Paralel" default **5** video serentak — mengimpor banyak video sekaligus membuat semua/mayoritas dirender bersamaan dan PC keriting. Pilihan lama juga tidak punya angka 2.
- Kini pilihan paralel menjadi **1 / 2 / 3 / 5 / 7** dan **default-nya 2×**: hanya 2 video yang dirender serentak, begitu satu selesai, antrean berikutnya langsung mengisi slot kosong — urutan tetap dari video pertama.
- Uji nyata 6 video sekaligus: puncak render serentak tercatat **2** (tidak pernah lebih), keenam video tuntas berurutan 2-2 sampai selesai. Masih bisa dinaikkan ke 3/5/7 di menu **07 Proses Paralel** bila PC kuat.

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh & install **`KolosalCut-Setup-1.3.2.exe`** (di bawah).
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Buka aplikasi — pastikan header tertulis **v1.3.2**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.3.2.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.3.2.exe` | Versi portabel tanpa instalasi |

---

# KolosalCut v1.3.1

Perbaikan penting: **impor "PILIH BEBERAPA VIDEO SEKALIGUS" kini benar-benar mengunggah** — tidak lagi mentok di status MENGUNGGAH 0%.

## Perbaikan: Unggahan Batch Mentok 0%

- **Penyebabnya** (race condition): antrean pengunggah dijalankan tepat saat daftar video baru saja ditambahkan, tetapi masih membaca daftar versi lama — sehingga pengunggah "tidak menemukan" video yang barusan masuk dan berhenti tanpa pernah mengunggah. Videonya tampak masuk antrean, tapi statusnya diam di **0%** dan tidak bisa diproses.
- **Kini** antrean unggahan otomatis berjalan setiap daftar antrean berubah — video langsung diunggah satu per satu dengan progres berjalan normal, lalu berstatus **SIAP** dan siap di-**PROSES**.
- Bonus: unggahan yang sempat terputus/nyangkut juga otomatis dilanjutkan tanpa perlu mengimpor ulang.
- Unggah tunggal (Tarik & Lepas) tidak terdampak — tetap bekerja seperti biasa.
- Sudah diverifikasi uji end-to-end nyata: impor batch 3 video sekaligus → 3× SIAP → PROSES SEMUA → 3× SELESAI dengan hasil 1080×1920.

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh & install **`KolosalCut-Setup-1.3.1.exe`** (di bawah).
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Buka aplikasi — pastikan header tertulis **v1.3.1**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.3.1.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.3.1.exe` | Versi portabel tanpa instalasi |

---

# KolosalCut v1.3.0

Fitur baru di menu **07 Rasio & Zoom**: slider **AMBIL BAGIAN** — geser kiri ↔ kanan untuk menentukan **bagian mana dari video yang diambil** saat di-zoom / dipotong ke 9:16.

## Slider Baru: "Ambil Bagian" (Kiri ↔ Kanan)

- Ada di **menu 07 Rasio & Zoom**, persis di bawah slider Zoom — geser dari **KIRI (0%)** ke **KANAN (100%)**, tengah = **50%**.
- **9:16 Penuh**: film layar lebar (16:9) harus dipotong agar muat 9:16 — sebelumnya selalu bagian **tengah** yang diambil. Sekarang kamu yang menentukan: geser ke kiri untuk mengambil aksi di sisi kiri layar, geser ke kanan untuk sisi kanan.
- **9:16 Biasa + Blur**: geser untuk memindahkan posisi video ke kiri/kanan di antara latar blur — pas untuk komposisi takarir. Saat di-zoom (>1×), slider menjadi titik ambil bagian yang tetap terlihat.
- **Pratinjau langsung**: geser slidernya, monitor pratinjau langsung mengikuti — apa yang kamu lihat = apa yang dirender.
- Berlaku juga untuk tombol **TERAPKAN SETELAN KE SEMUA** — posisi ambil tersalin ke semua video antrean.
- Nilai bawaan **Tengah (50%)** = perilaku lama, jadi setelan lama kamu tidak berubah.

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh & install **`KolosalCut-Setup-1.3.0.exe`** (di bawah).
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Buka aplikasi — pastikan header tertulis **v1.3.0**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.3.0.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.3.0.exe` | Versi portabel tanpa instalasi |

---

# KolosalCut v1.2.1

Perbaikan tampilan timeline: **tombol bagian (P1–P50) tidak lagi meluber keluar panel ke menu lain** — persis masalah pada laporanmu saat memproses film 2 jam menjadi 50 bagian.

## Perbaikan: Timeline Tidak Meluber ke Menu Lagi

- **Nama masalahnya**: *overflow* — elemen UI melebihi batas wadahnya. Sebelumnya, 50 tombol bagian dipaksa muat satu baris (±1.700 px) padahal panel hanya ±900 px, sehingga tombol-tombol itu menembus sisi kanan panel timeline dan menutupi menu lain (Terapkan Setelan / Proses).
- **Kini** daftar bagian tinggal di dalam panelnya dan bisa **digulir ke samping** (scroll) bila jumlah bagian banyak:
  - Scroll mouse / trackpad, atau geser langsung daftar tombolnya.
  - Tombol panah ‹ › di tepi kiri-kanan muncul otomatis saat daftar bisa digulir.
  - Bagian yang kamu pilih **otomatis digulir ke tengah** — tidak perlu berburu tombol P40 di antara 50 bagian.
  - Ruler waktu & playhead ikut menggulir, jadi selalu sejajar dengan klip.
- Untuk video sedikit bagian (mis. 5–10 bagian), tampilan tetap sama persis seperti dulu — memenuhi lebar panel.

> Catatan: film 2:00:20 yang butuh 121 bagian tetap dibagi rata menjadi 50 bagian (±2:24/bagian) sesuai perbaikan v1.2.0 — tidak ada bagian video yang terlewat.

---

# KolosalCut v1.2.0

Tiga fitur besar hasil masukan kamu: **impor video sampai 10 GB**, **pilih sendiri folder hasil render**, dan **perbaikan penting pembagian video** — kini tidak ada lagi bagian video yang terlewat di ujung.

## 1. Impor Video sampai 10 GB

Sebelumnya file video dibatasi **500 MB**. Sekarang kamu bisa mengimpor video **sampai 10 GB** per file.

- Cara kerja baru: video di-**streaming** langsung ke disk aplikasi (dulu: seluruh file dimuat ke memori dulu — inilah yang membuat file besar tidak mungkin).
- Dukungan penuh untuk film panjang 1–3 jam dengan resolusi tinggi.
- Progres unggahan tetap tampil, semua berjalan lokal tanpa internet.

## 2. Pilih Folder Hasil Render & Split

Tidak perlu lagi mencari-cari folder data aplikasi — tentukan sendiri tempat hasil disimpan:

- Buka **tab Video → bagian 09 "Folder Hasil Render" → tombol PILIH FOLDER HASIL…**
- Muncul dialog folder Windows; hasil render & split **langsung ditulis ke folder pilihanmu**.
- Setiap video mendapat **subfolder sendiri sesuai judulnya** (mis. `D:\Reels\Film-Uji\Film-Uji-Part-1.mp4`) — rapi, tidak menumpuk.
- Pilihan folder **tersimpan permanen** — tidak perlu memilih ulang tiap kali membuka aplikasi.
- Setelah render selesai, panel hasil menampilkan lokasi folder + tombol **BUKA FOLDER HASIL** yang langsung membuka Windows Explorer.
- Tombol **TERAPKAN SETELAN KE SEMUA** juga membawa folder hasil ke semua video.

## 3. Perbaikan Penting: Video Kini Terbagi HABIS sampai Ujung

Ada cacat tersembunyi pada pembagian video panjang — persis seperti pada laporan kamu:

- **Dulu**: video 57:14 dipotong 1 menit/bagian butuh 58 bagian, tapi aplikasi berhenti di 50 bagian (50:00) — **7:14 terakhir video tidak ikut terbagi** (di timeline, video "melewati batas sampai ke ujung frame").
- **Kini**: bila pengaturanmu menghasilkan lebih dari 50 bagian, **seluruh video dibagi rata otomatis** menjadi 50 bagian (mis. 57:14 → 50 bagian @ ±1:09) — **tidak ada satu detik pun yang terlewat**.
- Timeline menampilkan lencana **"TERBAGI HABIS"** + pemberitahuan penjelasan saat pembagian rata aktif.
- Berlaku juga pada hasil render (bukan hanya pratinjau) — sudah diverifikasi otomatis: total durasi semua bagian = durasi penuh video.

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh **`KolosalCut-Setup-1.2.1.exe`** di bawah.
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Install & buka — pastikan di pojok kanan header tertulis **v1.2.1**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.2.1.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.2.1.exe` | Versi portabel tanpa instalasi |

## Persyaratan Sistem

- Windows 10 / 11 (64-bit)
- RAM 8 GB disarankan untuk render paralel 5–7 video
- Ruang disk kosong: ± video sumber + hasil (video 10 GB butuh ruang lebih)
