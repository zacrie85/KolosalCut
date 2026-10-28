/**
 * KolosalCut — preload (jembatan aman renderer <-> main process).
 * Menyediakan API desktop dalam sandbox contextIsolation:
 *  - selectOutputDir(): buka dialog pilih folder hasil render & split
 *  - openPath(p)     : buka folder/berkas di Windows Explorer
 *  - pickFiles()     : (cadangan) dialog pilih berkas video
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kolosalAPI", {
  isDesktop: true,
  /** Buka dialog pilih folder untuk menyimpan hasil render. null = dibatalkan */
  selectOutputDir: () => ipcRenderer.invoke("kolosal:select-output-dir"),
  /** Buka folder hasil di Explorer. true = sukses */
  openPath: (p) => ipcRenderer.invoke("kolosal:open-path", p),
});
