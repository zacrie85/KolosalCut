# KolosalCut

<div align="center">
  <img src="build/icon.png" width="96" alt="Logo KolosalCut" />
</div>

**KolosalCut** adalah aplikasi desktop Windows untuk memotong dan memecah video panjang menjadi beberapa bagian reel (Part / Bagian / Eps / Episode) siap unggah ke media sosial — lengkap dengan cover sinematik, judul, label, dan deskripsi yang tampil di dalam video.

Dibangun dengan **Next.js** (antarmuka), **FFmpeg** (render video), dan **Electron** (pembungkus desktop Windows). FFmpeg sudah dibundel di dalam aplikasi, jadi semuanya berjalan **100% offline** tanpa perlu instalasi tambahan.

## Fitur

- **Impor batch hingga 50 video** sekaligus — diproses berurutan sesuai antrean
- **Render paralel** — 1, 3, 5, atau 7 video dirender serentak
- **Terapkan setelan ke semua video** — setel sekali, berlaku ke seluruh antrean
- **7 font sinematik** (Anton, Bebas Neue, Oswald, Montserrat, Playfair, Cinzel, Archivo Black) + pengaturan ukuran font per teks
- **Gaya frame neon berputar** (emas / ganda / pelangi) yang mengelilingi frame 9:16 + **4 frame minimalis** (putih, emas, sudut, garis)
- **Pisah otomatis** — mode durasi per bagian (manual) atau jumlah bagian yang diinginkan
- **Cover sinematik 2–3 detik** dengan efek zoom halus di awal setiap bagian
- **Judul otomatis** diambil dari nama file
- **Label bagian fleksibel** — pilih kata Part / Bagian / Eps / Episode
- **Teks deskripsi** bebas diisi dan diposisikan
- **Rasio 9:16** — mode fullscreen atau normal dengan latar blur
- **Posisi teks bebas** — geser judul/label/deskripsi ke atas, bawah, kiri, kanan lewat panel geser, tombol panah, atau drag langsung di pratinjau
- **Pilihan kualitas render** — Cepat / Seimbang / Tinggi
- **Unduh hasil** langsung ke folder pilihan Anda

## Instalasi (Pengguna Windows)

1. Buka halaman [**Releases**](https://github.com/zacrie85/KolosalCut/releases).
2. Unduh `KolosalCut-Setup-x.x.x.exe` (installer) atau `KolosalCut-Portable-x.x.x.exe` (tanpa instalasi).
3. Jika SmartScreen memperingatkan *"Windows protected your PC"* (aplikasi belum ditandatangani digital), klik **More info → Run anyway**.
4. Selesai — buka **KolosalCut** dari desktop dan mulai memecah video Anda.

> Persyaratan: Windows 10/11 64-bit, RAM 4 GB+, ruang disk ± 1 GB.

## Menjalankan dari Kode Sumber

```bash
bun install
bun run dev      # mode pengembangan
bun run build    # build produksi (standalone)
bun run start    # jalankan hasil build
```

## Membuat Installer Windows

Build dilakukan otomatis oleh **GitHub Actions** setiap ada push ke `main` (artefak tersedia di tab *Actions*), dan menghasilkan rilis `.exe` setiap ada tag `v*`.

Untuk membangun manual di Windows:

```bash
bun install
bun run build
bun run dist:win   # hasil ada di folder release/
```

## Struktur Proyek

```
electron/main.js          # Proses utama Electron (jendela desktop + server lokal)
src/app/                  # Antarmuka Next.js (App Router)
src/app/api/              # API unggah, proses render, status job, unduhan file
src/lib/server/ffmpeg.ts  # Integrasi FFmpeg (probe, filter, render)
src/lib/video-config.ts   # Konfigurasi preset, segmen & pengaturan
scripts/                  # Skrip pendukung build
resources/                # Font yang dibundel
.github/workflows/        # CI build Windows
```

---

Dibuat dengan semangat sinema oleh [zacrie85](https://github.com/zacrie85).
