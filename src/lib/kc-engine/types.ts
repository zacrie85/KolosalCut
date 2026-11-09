// NOVACUT Studio - Type definitions

export type TrackKind = "video" | "image" | "text" | "audio";
export type MediaType = "video" | "audio" | "image";
export type ClipKind = "video" | "image" | "text" | "audio";

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  url: string;
  duration: number; // detik; image = 0 (tak terbatas)
  width: number;
  height: number;
  thumb?: string; // data URL
  musicId?: string; // untuk aset dari pustaka musik
  /** v1.0.17: objek File asli (tidak terserialisasi) — mesin Turbo membaca
   * film lewat akses acak File.slice tanpa memuat utuh ke memori */
  file?: File;
  /** KolosalCut v1.4.0: id unggahan di server lokal — dipakai teks otomatis offline */
  kcUploadId?: string;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
}

export type TextPos = "top" | "center" | "bottom";
export type TextBg = "none" | "bar" | "box" | "gradient";

export interface TextData {
  content: string;
  sub?: string;
  size: number; // relatif tinggi canvas (mis. 0.08 = 8% tinggi)
  /** ukuran baris kedua (sub/deskripsi); default = size * 0.42 */
  subSize?: number;
  color: string;
  font: string; // font id
  /** font id untuk baris kedua; default "sans" */
  subFont?: string;
  anim: string; // text anim id
  pos: TextPos;
  bg: TextBg;
  stroke: boolean;
  /** geser horizontal seluruh blok teks (fraksi lebar layar, -0.45..0.45) */
  offX?: number;
  /** geser vertikal blok teks (fraksi tinggi layar, -0.45..0.45) */
  offY?: number;
  /** geser horizontal baris deskripsi (fraksi lebar layar) */
  subOffX?: number;
  /** geser vertikal baris deskripsi (fraksi tinggi layar) */
  subOffY?: number;
  /** v1.4.3: posisi vertikal LANGSUNG blok teks (fraksi tinggi layar 0..1;
   * 0 = paling atas, 1 = paling bawah). Bila ada, menimpa pos/offY sebagai
   * posisi dasar — offY tetap berlaku sebagai geser halus tambahan. */
  posV?: number;
  /** v1.4.3: id bingkai di belakang blok teks (lihat titleFrames.ts;
   * ""/undefined = tanpa bingkai). Interior bingkai kosong — video terlihat. */
  frame?: string;
  /** v1.4.3: skala LEBAR bingkai (0.6–2.5; 1 = otomatis ikut lebar tulisan) */
  frameW?: number;
  /** v1.4.3: skala TINGGI bingkai (0.6–2.5; 1 = otomatis ikut tinggi tulisan) */
  frameH?: number;
}

export interface TransitionSpec {
  type: string;
  duration: number;
}

export interface Clip {
  id: string;
  trackId: string;
  kind: ClipKind;
  assetId?: string;
  start: number; // posisi di timeline (detik)
  duration: number; // durasi di timeline (detik, sudah termasuk speed & loop)
  inPoint: number; // titik awal pada sumber (detik sumber)
  speed: number; // 0.25 - 4
  loopCount: number; // 1 = sekali; >1 = ulang potongan
  volume: number; // 0 - 2
  fadeIn: number; // detik
  fadeOut: number; // detik
  transition?: TransitionSpec; // transisi masuk (di awal klip)
  effects: string[]; // id efek klip
  text?: TextData;
  label?: string;
  zoom: number; // 1 - 5 (1 = ukuran asli / utuh tanpa potong; >1 = perbesaran manual, penting untuk rasio 9:16)
  panX: number; // -1..1 geser horizontal (kanan = gambar ke kanan)
  panY: number; // -1..1 geser vertikal (bawah = gambar ke bawah)
}

export interface TextsConfig {
  title: string;
  description: string;
  labelStyle: "Part" | "Episode" | "Bagian" | "Eps" | "EP";
  parts: number;
  /** ukuran huruf JUDUL (relatif tinggi layar, 0.02–0.2) — dipakai export playlist & tombol tambah teks */
  titleSize?: number;
  /** ukuran huruf DESKRIPSI (relatif tinggi layar) */
  descSize?: number;
  /** ukuran huruf PART/EPISODE/BAGIAN (relatif tinggi layar) */
  partSize?: number;
  /** id font untuk tulisan otomatis judul/deskripsi/part */
  fontAuto?: string;
  /** posisi judul: geser horizontal/vertikal dalam % lebar/tinggi layar (-45..45) */
  titleX?: number;
  titleY?: number;
  /** posisi deskripsi (baris kedua): geser horizontal/vertikal % layar */
  descX?: number;
  descY?: number;
  /** posisi teks part/episode: geser horizontal/vertikal % layar */
  partX?: number;
  partY?: number;
  /** v1.4.3: posisi vertikal blok JUDUL+DESKRIPSI saat video berjalan:
   * 0 = paling atas, 100 = paling bawah (default 100 — di bawah) */
  titleV?: number;
  /** v1.4.3: posisi vertikal teks PART/EPISODE saat video berjalan:
   * 0 = paling atas, 100 = paling bawah (default 0 — di atas) */
  partV?: number;
  /** v1.4.3: bingkai judul — id dari TITLE_FRAMES ("" = tanpa bingkai) */
  titleFrame?: string;
  /** v1.4.3: skala LEBAR bingkai judul (0.6–2.5; 1 = otomatis ikut tulisan) */
  titleFrameW?: number;
  /** v1.4.3: skala TINGGI bingkai judul (0.6–2.5; 1 = otomatis ikut tulisan) */
  titleFrameH?: number;
}

/** v1.0.19: gaya bingkai di sekeliling gambar cover — dipilih manual pengguna */
export type CoverFrameStyle = "none" | "klasik" | "modern" | "futuristik";

export interface CoverConfig {
  frameAssetId?: string; // video sumber
  frameTime: number; // detik frame yang dipakai
  templateId: string; // "layout--palette"
  duration: number; // 2 - 5 detik saat export & split
  useAI: boolean;
  mode: "auto" | "manual"; // auto = ambil adegan dari video; manual = gambar unggahan pengguna
  manualAssetId?: string; // asset gambar unggahan (PNG/JPG)
  manualPlain?: boolean; // mode manual: gambar apa adanya tanpa teks template
  /** Latar cover mode otomatis: "adegan" = gambar dari adegan video; "hitam" = hitam polos */
  bgStyle: "adegan" | "hitam";
  /** Penyebaran latar saat export & split: "sama" = 1 latar untuk semua bagian; "beda" = tiap bagian adegan berbeda */
  bgScope: "sama" | "beda";
  /** v1.0.19: bingkai cover (klasik/modern/futuristik) — digambar transparan 75% mengelilingi gambar cover */
  frameStyle?: CoverFrameStyle;
  coverAssetId?: string; // hasil render cover (image asset)
  previewUrl?: string;
}

/** Setelan efek & klip yang diterapkan ke setiap video hasil export langsung dari Playlist
 * (diatur lewat menu Efek & menu Klip dengan target "Video Playlist") */
export interface PlaylistEnhance {
  /** master: terapkan setelan ini ke hasil export playlist */
  enabled: boolean;
  /** kecepatan 0.25–4 (1 = normal) */
  speed: number;
  /** ulang potongan 1–10 (1 = sekali) */
  loopCount: number;
  /** volume audio video 0–2 (1 = normal) */
  volume: number;
  /** fade in audio+visual (detik) */
  fadeIn: number;
  /** fade out (detik) */
  fadeOut: number;
  /** id efek visual/color grading (lihat CLIP_EFFECTS) */
  effects: string[];
  /** transisi masuk (id) bila ada cover di depan */
  transitionType: string | null;
  transitionDuration: number;
  /** zoom manual 1–5 (1 = sesuai mode rasio) */
  zoom: number;
  /** geser horizontal -1..1 */
  panX: number;
  /** geser vertikal -1..1 */
  panY: number;
}

/** Setelan khusus export langsung dari Playlist (tanpa timeline) */
export interface PlaylistExportConfig {
  /** judul otomatis diambil dari nama video tiap batch */
  autoTitle: boolean;
  /** judul manual bila autoTitle dimatikan */
  titleCustom: string;
  /** deskripsi yang tampil di bawah judul pada layar cover */
  description: string;
  /** gaya teks part: Part / Episode / Bagian / Eps / EP */
  labelStyle: TextsConfig["labelStyle"];
  /** tampilkan layar judul (cover) di awal setiap hasil */
  showTitleScreen: boolean;
  /** tampilkan teks part otomatis di setiap hasil split */
  showPartText: boolean;
  /** tampilkan judul overlay selama video berjalan */
  titleDuringVideo: boolean;
  /** rasio video hasil: "16:9" lanskap (seperti aslinya) atau "9:16" vertikal (Shorts/TikTok/Reels) */
  ratio: Ratio;
  /** cara pas video ke frame 9:16: "fill" = isi penuh (sisi dilepas/potong); "fit" = video utuh (ada bar hitam) */
  fitMode: "fill" | "fit";
  /** efek & klip untuk semua hasil export playlist (dari menu Efek / Klip target "Video Playlist") */
  enhance?: PlaylistEnhance;
  /** subtitle AI otomatis dari suara video (burn-in ke hasil render) */
  autoSub?: boolean;
  /** tingkat akurasi model AI subtitle: ringan (cepat) / sedang / akurat (paling teliti) */
  subLevel?: SubLevel;
  /** berapa video dirender BERSAMAAN (paralel) 1–5 */
  parallel?: number;
  /** v1.0.16: kualitas hasil — ringan (720p, file kecil & tercepat) / tajam (1080p) / maksimal (1080p, bitrate tinggi) */
  quality?: "ringan" | "tajam" | "maksimal";
  /** v1.0.16: geser titik potong ke jeda sunyi audio — klip tidak motong kalimat */
  smartSplit?: boolean;
  /** v1.0.16: lanjutkan batch terputus — lewati bagian yang filenya sudah ada di folder hasil */
  skipExisting?: boolean;
  /** v1.0.16: bunyi "ting" tiap film selesai + notifikasi Windows saat batch tuntas */
  soundDone?: boolean;
  /** v1.0.16: matikan PC otomatis 60 detik setelah batch selesai tanpa gagal */
  autoShutdown?: boolean;
  /** versi skema setelan (internal, untuk migrasi setelan lama) */
  cfgVersion?: number;
}

/** tingkat model AI subtitle */
export type SubLevel = "ringan" | "sedang" | "akurat";

export interface ExportSettings {
  mode: "single" | "split";
  splitBy: "count" | "duration";
  parts: number;
  partSeconds: number;
  includeCover: boolean;
  coverDuration: number;
  autoPartText: boolean;
  showTitleText: boolean;
  /** Folder tujuan hasil render (path absolut, mode desktop). "" = folder unduhan bawaan */
  exportDir: string;
  /** mesin render: "fast" = WebCodecs offscreen (tanpa memutar video, jauh lebih cepat); "compat" = rekam real-time (MediaRecorder) */
  engineMode: "fast" | "compat";
  /** subtitle AI otomatis dari suara video pada timeline (burn-in ke hasil render) */
  autoSub: boolean;
  /** tingkat akurasi model AI subtitle */
  subLevel: SubLevel;
}

export interface ExportResult {
  id: string;
  name: string;
  url: string;
  size: number;
  part: number;
  total: number;
  duration: number;
  /** Path file di disk bila otomatis tersimpan ke folder pilihan (desktop) */
  savedPath?: string;
  /** KolosalCut v1.4.0: id video (aset) pemilik hasil ini */
  kcJobId?: string;
}

export interface ExportState {
  running: boolean;
  label: string;
  progress: number; // 0..1
  /** v1.0.16: estimasi waktu tersisa (detik) — terisi setelah sebagian selesai */
  eta?: number;
  results: ExportResult[];
  batchTotal: number;
  batchIndex: number;
}

export type Ratio = "16:9" | "9:16";

/** mode tampilan aplikasi: layar sambutan / mode sederhana (wizard) / mode pro */
export type UiMode = "welcome" | "simple" | "pro";
/** dua daftar playlist terpisah: "editor" = antrean editing timeline,
 * "export" = antrean export & split langsung tanpa edit */
export type AssetListName = "editor" | "export";

/** status satu video dalam batch export paralel (ditampilkan per baris) */
export interface BatchJobView {
  /** sama dengan assetId video */
  id: string;
  name: string;
  status: "antre" | "jalan" | "selesai" | "gagal";
  /** 0..1 */
  progress: number;
  /** keterangan singkat (menyiapkan / part 2/5 / selesai / gagal) */
  label?: string;
}

export interface ProjectMeta {
  name: string;
  width: number;
  height: number;
  ratio: Ratio; // arah video: lanskap 16:9 atau vertikal 9:16
  quality: 720 | 1080; // sisi dasar resolusi
}
