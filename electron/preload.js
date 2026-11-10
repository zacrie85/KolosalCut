/**
 * KolosalCut — preload (jembatan aman renderer <-> main process).
 * Menyediakan API desktop dalam sandbox contextIsolation:
 *  - kolosalAPI.selectOutputDir(): dialog pilih folder hasil render & split
 *  - kolosalAPI.openPath(p)     : buka folder/berkas di Windows Explorer
 *  - kolosalAPI.filePathFor(f)  : v1.4.9 — path asli file di disk (webUtils)
 *                                 untuk TANPA UNGGAH: whisper membaca video
 *                                 langsung dari lokasi aslinya (nol salinan)
 *  - novacutFS.*  (v1.4.0)      : mesin render NOVACUT — tulis hasil
 *                                 langsung ke disk (stream chunk), stat
 *                                 file (lanjutkan batch), notifikasi
 *                                 Windows & matikan PC otomatis.
 */
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("kolosalAPI", {
  isDesktop: true,
  /** Buka dialog pilih folder untuk menyimpan hasil render. null = dibatalkan */
  selectOutputDir: () => ipcRenderer.invoke("kolosal:select-output-dir"),
  /** Buka folder hasil di Explorer. true = sukses */
  openPath: (p) => ipcRenderer.invoke("kolosal:open-path", p),
  /** v1.4.9: path asli file di disk — "" bila gagal/bukan file lokal */
  filePathFor: (file) => {
    try {
      return (file && webUtils.getPathForFile(file)) || "";
    } catch {
      return "";
    }
  },
});

// v1.4.0 — jembatan mesin render NOVACUT (fsBridge.ts membaca global ini)
contextBridge.exposeInMainWorld("novacutFS", {
  isDesktop: true,
  chooseDirectory: (current) => ipcRenderer.invoke("fs:choose-dir", current),
  saveFile: (dir, name, data) => ipcRenderer.invoke("fs:save-file", { dir, name, data }),
  saveFileBegin: (dir, name) => ipcRenderer.invoke("fs:save-begin", { dir, name }),
  saveFileChunk: (id, data, position) =>
    ipcRenderer.invoke("fs:save-chunk", { id, data, position }),
  saveFileEnd: (id) => ipcRenderer.invoke("fs:save-end", { id }),
  openFolder: (dir) => ipcRenderer.invoke("fs:open-folder", dir),
  statFile: (dir, name) => ipcRenderer.invoke("fs:stat-file", { dir, name }),
  notify: (title, body) => ipcRenderer.invoke("app:notify", { title, body }),
  shutdownPC: () => ipcRenderer.invoke("app:shutdown"),
});
