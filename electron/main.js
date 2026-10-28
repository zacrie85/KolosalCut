/**
 * KolosalCut — Electron main process (versi desktop Windows).
 *
 * Alur kerja:
 *  1. Mencari port bebas di localhost.
 *  2. Menjalankan server Next.js (build standalone) sebagai proses anak
 *     menggunakan runtime Node milik Electron (ELECTRON_RUN_AS_NODE=1).
 *  3. Mengarahkan FFmpeg/FFprobe/font ke binary yang dibundel di resources.
 *  4. Membuka jendela desktop yang memuat antarmuka aplikasi.
 */
const { app, BrowserWindow, dialog, Menu, shell } = require("electron");
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const fs = require("fs");

let serverProc = null;
let mainWindow = null;
let quitting = false;

const APP_DIR = path.join(process.resourcesPath, "app-standalone");
const SERVER_JS = path.join(APP_DIR, "server.js");
const BIN_DIR = path.join(process.resourcesPath, "bin");
const FONT_DIR = path.join(process.resourcesPath, "fonts");

function logLine(msg) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.appendFileSync(
      path.join(app.getPath("userData"), "kolosalcut.log"),
      `[${new Date().toISOString()}] ${msg}\n`
    );
  } catch {
    /* logging gagal — abaikan */
  }
}

function readLogTail() {
  try {
    const p = path.join(app.getPath("userData"), "kolosalcut.log");
    return fs
      .readFileSync(p, "utf8")
      .split("\n")
      .slice(-15)
      .join("\n");
  } catch {
    return "(log tidak tersedia)";
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 60000);
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (quitting) return reject(new Error("Aplikasi ditutup"));
      const sock = net.connect({ port, host: "127.0.0.1" });
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > deadline) {
          return reject(new Error("Server lokal tidak merespons (timeout)"));
        }
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function startServer(port) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    KOLOSAL_DATA_DIR: app.getPath("userData"),
    KOLOSAL_FONTS_DIR: path.join(FONT_DIR),
    KOLOSAL_OVERLAYS_DIR: path.join(process.resourcesPath, "overlays"),
    FFMPEG_PATH: path.join(BIN_DIR, "ffmpeg.exe"),
    FFPROBE_PATH: path.join(BIN_DIR, "ffprobe.exe"),
    FFMPEG_FONT: path.join(FONT_DIR, "Carlito-Bold.ttf"),
  };
  serverProc = spawn(process.execPath, [SERVER_JS], {
    cwd: APP_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProc.stdout.on("data", (d) =>
    logLine("[server] " + d.toString().trim())
  );
  serverProc.stderr.on("data", (d) =>
    logLine("[server:err] " + d.toString().trim())
  );
  serverProc.on("exit", (code) => {
    logLine("Server keluar dengan kode " + code);
    serverProc = null;
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        "KolosalCut",
        "Proses server lokal berhenti tidak terduga. Silakan buka kembali aplikasi."
      );
      app.quit();
    }
  });
  return serverProc;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#09090b",
    title: "KolosalCut",
    show: false,
    autoHideMenuBar: true,
    icon: path.join(process.resourcesPath, "app.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Buka link eksternal di browser bawaan, link internal tetap di jendela
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${port}`)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Dialog simpan file saat pengguna mengunduh video hasil render
  mainWindow.webContents.session.on("will-download", (event, item) => {
    const target = dialog.showSaveDialogSync(mainWindow, {
      title: "Simpan video",
      defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
    });
    if (!target) {
      event.preventDefault();
      return;
    }
    item.setSavePath(target);
    item.once("done", (e, state) => {
      if (state === "completed") {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Unduhan selesai",
          message: "Video berhasil disimpan:",
          detail: target,
          buttons: ["OK"],
        });
      } else if (state === "interrupted") {
        dialog.showErrorBox(
          "KolosalCut",
          "Unduhan terputus sebelum selesai."
        );
      }
    });
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      if (!fs.existsSync(SERVER_JS)) {
        throw new Error("Berkas server tidak ditemukan: " + SERVER_JS);
      }
      const port = await getFreePort();
      logLine("Memulai server di port " + port);
      startServer(port);
      await waitForPort(port);
      createWindow(port);
    } catch (err) {
      dialog.showErrorBox(
        "KolosalCut gagal dimulai",
        String((err && err.message) || err) +
          "\n\nLog terakhir:\n" +
          readLogTail()
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    quitting = true;
    app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        /* abaikan */
      }
      serverProc = null;
    }
  });
}
