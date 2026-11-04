# KolosalCut v1.4.2

TIGA UPGRADE SEKALIGUS: hasil export & split TIDAK lagi berkedip, tampilan teks cover kini PERSIS NOVACUT (judul di atas + deskripsi · Episode sebaris), dan mesin render dipercepat sampai memakai GPU secara penuh.

## 1. HASIL EXPORT & SPLIT TIDAK BERKEDIP LAGI ⚡

Penyebab kedip-kedip sudah ditemukan & dibasmi dari akarnya (diverifikasi analisis frame-per-frame):

- **Cover hitam di awal tiap bagian (penyebab utama)** — gambar cover yang belum selesai dimuat membuat 0,3–0,5 detik pertama TIAP bagian hitam lalu tiba-tiba muncul = terlihat berkedip saat diputar. Kini mesin menunggu semua gambar siap sebelum frame pertama di-encode (dicek ulang tiap setengah detik).
- **Frame neon muncul mendadak** — pemanasan overlay frame neon kini DITUNGGU sampai selesai sebelum render dimulai, jadi neon tampil utuh dari frame pertama.
- Terverifikasi: analisis `blackdetect` ffmpeg pada hasil split = **NOL frame hitam**, frame pertama langsung cover penuh.

## 2. TEKS & COVER PERSIS NOVACUT

- **8 FONT BARU** di menu TEKS (total 16): Teko, Barlow Condensed, Rajdhani, Russo One, Orbitron, Michroma, Righteous, Alfa Slab One — semua dibundel offline, pratinjau memakai font aslinya.
- **GAYA COVER NOVACUT (baru, aktif otomatis)** — persis cover referensimu: **judul di ATAS**, lalu **deskripsi + Part/Episode jadi SATU baris bersebelahan** dipisah "·" tepat di bawah judul, contoh: "Pemuda sombong satu serangan! · Episode 2/30". Baris ini muncul di cover dan di label isi video, serta ikut menamai file hasil.
  - Saklar ON/OFF ada di menu TEKS → bagian "Gaya Cover NOVACUT"; matikan bila ingin posisi bebas tiap teks seperti biasa.
  - Huruf tidak dipaksa KAPITAL lagi untuk template kustom — diketik apa muncul apa.

## 3. RENDER LEBIH CEPAT DARI SEBELUMNYA (TARGET: MELEBIHI NOVACUT)

- **Encoder kini di-probe pada resolusi ASLI 1080×1920** — dulu probe di 720p dengan profil Baseline Level 3.1 (batas resmi 720p!) sehingga encoder GPU Windows sering menolak lalu jatuh ke encoder SOFTWARE yang lambat. Kini profil dipilih High → Main → Baseline Level 4.0 (semua sah untuk 1080×1920).
- **GPU dipakai penuh**: encoder & decoder WebCodecs kini meminta akselerasi perangkat keras secara eksplisit (aman — otomatis kembali ke software bila GPU tak sanggup). Video kini di-encode GPU, di-decode GPU.
- **Paralel naik 5 → 7 video serentak** (antrean berbasis anggaran RAM tetap menjaga memori agar tidak pernah hang).
- Bukti nyata di mesin uji tanpa GPU sekalipun: video 20 detik + cover 2 detik pada 1080×1920 selesai dirender dalam ±20 detik (lebih cepat dari realtime).

## 4. Fitur v1.4.0–v1.4.1 tetap utuh

Mesin NOVACUT Studio penuh (WebCodecs offscreen, MESIN TURBO stream-copy, antrean RAM-budget, tulis langsung ke disk, lanjutkan batch, BATALKAN), 100 template cover, 28 transisi + 20 efek, zoom & geser, frame neon + bar sinema, teks otomatis whisper OFFLINE, OPTIMALKAN & BERSIHKAN CACHE.

---

**Diuji menyeluruh**: render polos (turbo murni), render bercover, dan mesin kilat kanvas — semua lolos analisis ffmpeg (blackdetect/freezedetect/reguleritas timestamp 33,33 ms seragam) + pemeriksaan visual frame; build produksi lulus penuh.

**Download**: `KolosalCut-Setup-1.4.2.exe` (install) atau `KolosalCut-Portable-1.4.2.exe` (tanpa install).
