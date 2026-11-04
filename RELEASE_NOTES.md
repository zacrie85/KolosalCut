# KolosalCut v1.3.6

Upgrade perawatan & performa! Panel **EKSPORT & SPLIT** kini punya bagian baru **SISTEM & PERAWATAN** dengan dua tombol andalan: **OPTIMALKAN** dan **BERSIHKAN CACHE** — plus dua perbaikan penting di mesin render.

## 1. Tombol OPTIMALKAN — Aplikasi Menyesuaikan PC-mu Otomatis ⚡

Sekali klik, KolosalCut membaca spesifikasi PC-mu lalu memasang setelan tercepat yang aman:

- **Mendeteksi**: jumlah core CPU, model CPU, besar RAM (total & bebas), dan GPU (NVIDIA terdeteksi otomatis via nvidia-smi; kartu lain via Windows WMI).
- **Memasang otomatis**: jumlah **render paralel** (1×–5×), **kualitas** (Ringan/Seimbang/Tinggi), dan **thread per video** — core dibagi rata ke setiap video yang dirender serentak, sehingga video tidak saling berebut tenaga komputer (penyebab klasik semua render melambat bersamaan dan PC terasa hang).
- **Diingat selamanya**: hasil optimasi tersimpan — aplikasi tetap optimal setelah ditutup dan dibuka lagi. Bisa diganti manual kapan saja lewat tombol KUALITAS / PARALEL di atasnya.
- Semua deteksi berjalan **lokal & offline** — tidak ada data yang dikirim ke mana pun.

Contoh: PC 2 core / RAM 4 GB → otomatis Paralel 1× + Kualitas Ringan + 2 thread/video (aman, tanpa hang). PC 12 core / RAM 32 GB → Paralel 5× + Kualitas Tinggi + 2 thread/video (gila kecepatan).

## 2. Tombol BERSIHKAN CACHE — Kembali Putih Seperti Baru Install 🧹

Memindai semua sisa data olahan, menampilkan ukurannya, lalu menghapusnya sesuai pilihanmu:

- **Sisa video sumber & data sementara** — video yang pernah kamu tambahkan beserta filenya di folder kerja. Aman dihapus; tinggal tambahkan ulang bila perlu.
- **Hasil render di folder bawaan** — *tidak dihapus otomatis*: kamu yang memilih (lewati bila masih ingin menyimpan videonya di situ).
- **Cache aplikasi & log** — cache tampilan (Cache / Code Cache / GPU Cache), log aplikasi, dan catatan proses FFmpeg terakhir. Dibuat ulang otomatis saat dibutuhkan.
- Menampilkan **total sisa data** dan **berapa besar yang berhasil dilepas** setelah dibersihkan.
- **Aman**: folder aplikasi sendiri tidak pernah disentuh, dan pembersihan otomatis **ditolak selagi masih ada video yang dirender** — tunggu selesai atau batalkan dulu.

## 3. Render Lebih Cepat: Thread Dibagi Rata ⚙️

Setiap video yang dirender kini mendapat jatah thread encoder **sebanding dengan jumlah video paralel** (core ÷ paralel). Sebelumnya setiap FFmpeg merebut SELURUH core — merender 3 video serentak berarti 3 proses saling berebut, semua melambat, RAM & CPU memuncak. Kini masing-masing jalan mulus di jalurnya sendiri: total waktu render paralel jauh lebih pendek dan PC tetap responsif.

## 4. Perbaikan: Render Polos Gagal "Error linking filters" 🐞

Ditemukan & diperbaiki bug di mesin render: pada video **tanpa cover, tanpa transisi, tanpa efek** (setelan paling polos), filter grafik mengirim **video ke filter audio** (`anull`) sehingga FFmpeg versi baru (7.x) menolak dengan pesan *Error linking filters*. Kini sudah benar (`null` untuk video) — dirender, diuji, dan lulus: video 12 detik jadi 1080×1920 H.264+AAC sempurna.

---

**Diuji langsung**: deteksi hardware lulus, pemindaian & pembersihan cache lulus (ukuran dihitung presisi byte-per-byte), render penuh dengan thread terbagi lulus, dan hasil video terverifikasi valid. Tetap 100% offline, tanpa API berbayar, tanpa watermark.

**Download**: pilih `KolosalCut-Setup-1.3.6.exe` (install) atau `KolosalCut-Portable-1.3.6.exe` (tanpa install).
