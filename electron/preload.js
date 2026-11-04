/**
 * KolosalCut — preload (jembatan aman renderer <-> main process).
 * Menyediakan API desktop dalam sandbox contextIsolation:
 *  - kolosalAPI.selectOutputDir(): dialog pilih folder hasil render & split
 *  - kolosalAPI.openPath(p)     : buka folder/berkas di Windows Explorer
 *  - novacutFS.*  (v1.4.0)      : mesin render NOVACUT — tulis hasil
 *                                 langsung ke disk (stream chunk), stat
 *                                 file (lanjutkan batch), notifikasi
 *                                 Windows & matikan PC otomatis.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kolosalAPI", {
  isDesktop: true,
  /** Buka dialog pilih folder untuk menyimpan hasil render. null = dibatalkan */
  selectOutputDir: () => ipcRenderer.invoke("kolosal:select-output-dir"),
  /** Buka folder hasil di Explorer. true = sukses */
  openPath: (p) => ipcRenderer.invoke("kolosal:open-path", p),
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
