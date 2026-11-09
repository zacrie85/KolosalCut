# KolosalCut v1.4.8

LAPORAN ANDA: "video hasil export & split-nya **kedip-kedip**." KETEMU PENYEBABNYA — dan ini bug lama yang baru terasa setelah v1.4.7, karena di PC Anda video dirender **MESIN KILAT** (badge "KILAT (decoder ...)" — kode video sumber tidak didukung dekoder Turbo), dan justru di jalur itulah ada cacat sejak v1.4.0.

## 1. PENYEBAB KEDIP-KEDIP: 5 BAGIAN PARALEL BERTEMU DI 1 ELEMEN VIDEO 🐞📺

- Saat export & split paralel (5x), **beberapa bagian dirender BERSAMAAN** — dan semuanya berasal dari film yang SAMA.
- Dulu, semua bagian itu memakai **SATU elemen `<video>` internal yang sama** (elemen disimpan per FILE, bukan per bagian). Akibatnya 5 "pompa decode" saling memutar / melompat-seek / menjeda ELEMEN YANG SAMA ke posisi masing-masing.
- Frame yang digambar jadi diambil dari **posisi acak film** (kadang dari menit ke-3, tiba-tiba menit ke-40, balik lagi) → saat diputar hasilnya **KEDIP-KEDIP**. Semakin tinggi paralel, semakin parah.
- Jalur TURBO tidak terkena (tiap bagian punya dekoder WebCodecs sendiri) — makanya bug ini lolos uji lama yang memakai MP4 (selalu Turbo). Di PC Anda yang jatuh ke mesin KILAT, bug-nya keluar semua.

## 2. PERBAIKAN: TIAP BAGIAN PUNYA ELEMEN VIDEO SENDIRI ✅

- Kini **setiap bagian yang dirender mendapat elemen `<video>` KHUSUS** untuk dirinya sendiri — pompa decode tidak mungkin saling ganggu lagi, sehebat apa pun paralelnya.
- Elemen khusus itu **dilepas bersih setelah bagiannya selesai** (dekoder tidak menumpuk antar bagian — jagaan anti layar-hitam lama tetap terjaga).
- Bonus jagaan: frame yang digambar kini **dipastikan tepat pada waktunya** — kalau decode sedikit meleset, langsung dikoreksi seek presisi (dulu boleh meleset sampai 0,1 dtk = kedipan halus sesekali).
- Bonus 2: elemen sementara pembuat cover otomatis juga kini dilepas setelah dipakai (dekode rapi dari awal sampai akhir batch).

## CATATAN

- **Kecepatan tidak berubah** — mesin Turbo + antrean paralel 5x + anti-mentok-99% tetap persis sama. Ini murni perbaikan kebenaran gambar pada jalur KILAT.
- Uji: E2E baru khusus jalur KILAT — video uji 12 scene warna (1 dtk per scene, WebM agar Turbo gugur) di-split "Berapa bagian"=4 dengan paralel aktif: hasil **tepat 4 file**, lalu SETIAP frame hasil di-periksa warna+urutannya: bagian ke-1 = scene 0-2, ke-2 = scene 3-5, ke-3 = scene 6-8, ke-4 = scene 9-11, **semua urut, 0 lompatan balik, 0 frame dari posisi salah** (= mustahil kedip). Regresi jalur Turbo (v1.4.7) + mode durasi + 9 tes logika split: semua lulus. tsc bersih, build desktop lulus.
