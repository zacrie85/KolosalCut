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
2. Unduh **`KolosalCut-Setup-1.2.0.exe`** di bawah.
3. Jika SmartScreen muncul: **More info → Run anyway**.
4. Install & buka — pastikan di pojok kanan header tertulis **v1.2.0**.

## Isi Rilis

| Berkas | Keterangan |
|---|---|
| `KolosalCut-Setup-1.2.0.exe` | Installer Windows (disarankan) |
| `KolosalCut-Portable-1.2.0.exe` | Versi portabel tanpa instalasi |

## Persyaratan Sistem

- Windows 10 / 11 (64-bit)
- RAM 8 GB disarankan untuk render paralel 5–7 video
- Ruang disk kosong: ± video sumber + hasil (video 10 GB butuh ruang lebih)
