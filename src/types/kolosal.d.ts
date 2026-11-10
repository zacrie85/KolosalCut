/**
 * API desktop KolosalCut yang diekspos electron/preload.js
 * ke dalam renderer (contextIsolation aman).
 */
interface KolosalDesktopAPI {
  isDesktop: boolean;
  /** buka dialog pilih folder hasil render — null jika dibatalkan */
  selectOutputDir: () => Promise<string | null>;
  /** buka folder/berkas di Windows Explorer — true jika sukses */
  openPath: (p: string) => Promise<boolean>;
  /** v1.4.9 TANPA UNGGAH: path asli file di disk (webUtils.getPathForFile) —
   * dipakai teks otomatis (whisper) membaca video langsung tanpa salinan.
   * "" bila gagal / bukan file lokal. */
  filePathFor: (file: File) => string;
}

interface Window {
  kolosalAPI?: KolosalDesktopAPI;
}
