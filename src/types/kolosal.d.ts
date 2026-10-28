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
}

interface Window {
  kolosalAPI?: KolosalDesktopAPI;
}
