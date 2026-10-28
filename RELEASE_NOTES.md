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
