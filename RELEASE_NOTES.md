# KolosalCut v1.1.1

Perbaikan pasti untuk error **"KolosalCut gagal dimulai (Server lokal tidak merespons)"** yang masih terjadi di v1.1.0.

## Akar Masalah (ditemukan & dibuktikan lewat reproduksi)

Pembungkus installer (electron-builder) **melewatkan folder `node_modules`** saat menyalin
server aplikasi ke dalam installer — jadi di komputer kamu, aplikasi jalan tanpa modul inti
(`next`) dan server langsung mati: `MODULE_NOT_FOUND` di `server.js:16`.
Uji otomatis sebelumnya menguji salinan *sebelum* dikemas, sehingga cacat ini lolos di
v1.0.0 maupun v1.1.0.

## Solusi v1.1.1

- **Server kini dibawa sebagai satu file ZIP** dan **diekstrak sendiri oleh aplikasi** saat pertama kali dibuka — tidak lagi melewati mekanisme penyalinan installer yang bermasalah.
- **Gerbang uji baru di CI**: server hasil *paketan* kini dinyalakan dengan runtime Electron asli sebelum dirilis. Kalau gagal, installer tidak akan pernah terbit.
- **Splash screen** "Menyiapkan server…" saat ekstraksi pertama (±5–10 detik, hanya sekali per versi).
- **Versi aplikasi tampil di pojok kanan header** — pastikan tertulis **v1.1.1** setelah install.
- Pesan error kini menyebut modul yang hilang + lokasi log, bila ada masalah lain.
- Ukuran installer lebih ramping (server dikemas bersih tanpa berkas sisa).

## Cara Upgrade

1. **Uninstall** KolosalCut lama (Settings → Apps → KolosalCut → Uninstall).
2. Unduh **`KolosalCut-Setup-1.1.1.exe`** di bawah.
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Install & buka — layar "Menyiapkan server…" muncul sebentar, lalu aplikasi terbuka.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.1.1.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.1.1.exe` | Versi portabel tanpa instalasi |

## Persyaratan Sistem

- Windows 10 / 11 (64-bit)
- RAM 8 GB disarankan untuk render paralel 5–7 video
- Ruang disk kosong ± 2 GB
