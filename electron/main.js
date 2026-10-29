/**
 * KolosalCut — Electron main process (versi desktop Windows).
 *
 * Alur kerja (v1.1.1):
 *  1. Mencari port bebas di localhost.
 *  2. Menyiapkan "runtime server": mengekstrak resources/app-standalone.zip
 *     (dibuat oleh scripts/post-build.mjs) ke folder data pengguna.
 *     -> Ekstraksi mandiri ini menghindari bug electron-builder yang
 *        meng-skip folder node_modules pada extraResources
 *        (penyebab MODULE_NOT_FOUND v1.0.0 & v1.1.0).
 *  3. Menjalankan server Next.js standalone sebagai proses anak memakai
 *     runtime Node milik Electron (ELECTRON_RUN_AS_NODE=1).
 *  4. Mengarahkan FFmpeg/FFprobe/font/overlay ke binary yang dibundel.
 *  5. Membuka jendela desktop yang memuat antarmuka aplikasi.
 */
const { app, BrowserWindow, dialog, Menu, shell, ipcMain } = require("electron");
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");

const APP_VERSION = app.getVersion();
let serverProc = null;
let mainWindow = null;
let splashWin = null;
let quitting = false;

const ZIP_PATH = path.join(process.resourcesPath, "app-standalone.zip");
const BIN_DIR = path.join(process.resourcesPath, "bin");
const FONT_DIR = path.join(process.resourcesPath, "fonts");

// Runtime server diekstrak ke folder data pengguna (selalu bisa ditulis,
// tidak tergantung hak akses Program Files, dan bersih antar versi)
const RUNTIME_DIR = path.join(app.getPath("userData"), "server-runtime");
const APP_DIR = path.join(RUNTIME_DIR, "app-standalone");
const SERVER_JS = path.join(APP_DIR, "server.js");
const VERSION_MARKER = path.join(RUNTIME_DIR, ".kolosal-version");

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

function logPath() {
  try {
    return path.join(app.getPath("userData"), "kolosalcut.log");
  } catch {
    return "(tidak tersedia)";
  }
}

function readLogTail() {
  try {
    const p = logPath();
    return fs.readFileSync(p, "utf8").split("\n").slice(-15).join("\n");
  } catch {
    return "(log tidak tersedia)";
  }
}

/** Ambil nama modul yang hilang dari pesan error Node (jika ada) */
function missingModuleFrom(text) {
  const m = text.match(/Cannot find module ['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

/** Dialog error dengan konteks versi + lokasi log agar mudah dilaporkan */
function showFatal(message, extraLog) {
  const detail =
    `${message}\n\n` +
    (extraLog ? extraLog + "\n\n" : "") +
    `Versi aplikasi : ${APP_VERSION}\n` +
    `Berkas log     : ${logPath()}\n\n` +
    `Log terakhir:\n${readLogTail()}`;
  logLine("[FATAL] " + message);
  dialog.showErrorBox(`KolosalCut gagal dimulai (v${APP_VERSION})`, detail);
}

function showSplash(text) {
  splashWin = new BrowserWindow({
    width: 440,
    height: 220,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#060a14",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWin.once("ready-to-show", () => splashWin.show());
  const body = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  splashWin.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(
        `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;height:100%;background:#060a14;display:flex;flex-direction:column;
        align-items:center;justify-content:center;font-family:system-ui,'Segoe UI',sans-serif;color:#e2f5ff}
        h1{font-size:17px;letter-spacing:.14em;margin:0 0 14px}
        h1 b{background:linear-gradient(90deg,#22d3ee,#818cf8);-webkit-background-clip:text;background-clip:text;color:transparent}
        .spin{width:34px;height:34px;border:3px solid rgba(34,211,238,.2);border-top-color:#22d3ee;
        border-radius:50%;animation:s .8s linear infinite}
        @keyframes s{to{transform:rotate(360deg)}}
        p{font-size:12px;color:#7dd3fc;opacity:.75;margin:14px 0 0;letter-spacing:.06em}
        </style></head><body>
        <h1>KOLOSAL<b>CUT</b> <span style="font-size:11px;color:#5eead4">v${APP_VERSION}</span></h1>
        <div class="spin"></div><p>${body}</p>
        </body></html>`
      )
  );
}

function closeSplash() {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  splashWin = null;
}

/**
 * Siapkan runtime server: ekstrak zip jika versi berubah / belum ada.
 * Melempar Error dengan pesan jelas jika berkas kritis tidak ditemukan.
 */
function prepareRuntime() {
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(
      "Berkas runtime tidak ditemukan dalam instalasi:\n" + ZIP_PATH +
      "\n\nKemungkinan installer tidak lengkap — unduh ulang KolosalCut-Setup dari halaman rilis GitHub."
    );
  }

  let needExtract = true;
  if (fs.existsSync(VERSION_MARKER) && fs.existsSync(SERVER_JS)) {
    const current = fs.readFileSync(VERSION_MARKER, "utf8").trim();
    needExtract = current !== APP_VERSION;
  }
  if (fs.existsSync(SERVER_JS) && !fs.existsSync(path.join(APP_DIR, "node_modules"))) {
    needExtract = true; // hasil ekstraksi lama rusak/tidak lengkap -> paksa ulang
  }

  if (needExtract) {
    logLine(`Mengekstrak runtime server v${APP_VERSION} ke ${RUNTIME_DIR}`);
    fs.rmSync(APP_DIR, { recursive: true, force: true });
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    const zip = new AdmZip(ZIP_PATH);
    zip.extractAllTo(RUNTIME_DIR, true);
    fs.writeFileSync(VERSION_MARKER, APP_VERSION, "utf8");
    logLine("Ekstraksi runtime selesai");
  }

  // Pre-flight: pastikan bagian kritis benar-benar ada sebelum spawn
  const checks = [
    [SERVER_JS, "server.js"],
    [path.join(APP_DIR, "node_modules", "next", "package.json"), "paket next (node_modules)"],
    [path.join(APP_DIR, ".next"), "berkas build .next"],
  ];
  for (const [p, label] of checks) {
    if (!fs.existsSync(p)) {
      throw new Error(
        `Berkas runtime tidak lengkap: ${label} hilang.\nDiharapkan di: ${p}\n\n` +
        "Coba hapus folder berikut lalu buka aplikasi lagi:\n" + RUNTIME_DIR
      );
    }
  }
  logLine("Runtime siap (v" + APP_VERSION + "): " + APP_DIR);
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
    // v1.3.3: mesin teks otomatis (Whisper) + model suara
    WHISPER_PATH: path.join(BIN_DIR, "whisper-cli.exe"),
    KOLOSAL_WHISPER_MODELS_DIR: path.join(process.resourcesPath, "models"),
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
  serverProc.stderr.on("data", (d) => {
    const text = d.toString().trim();
    logLine("[server:err] " + text);
    lastServerErr = text;
  });
  serverProc.on("exit", (code) => {
    logLine("Server keluar dengan kode " + code);
    serverProc = null;
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      const missing = missingModuleFrom(lastServerErr || "");
      dialog.showErrorBox(
        "KolosalCut",
        "Proses server lokal berhenti tidak terduga." +
          (missing
            ? `\n\nModul hilang: ${missing}`
            : "") +
          `\n\nVersi: ${APP_VERSION}\nLog: ${logPath()}`
      );
      app.quit();
    }
  });
  return serverProc;
}

let lastServerErr = "";
let lastOutputDir = "";

// ============================================================
// IPC desktop: pilih folder hasil render & buka folder hasil
// ============================================================
ipcMain.handle("kolosal:select-output-dir", async () => {
  try {
    const res = await dialog.showOpenDialog({
      title: "Pilih Folder Hasil Render & Split",
      message: "Semua file video hasil render akan disimpan ke folder ini",
      defaultPath: lastOutputDir || app.getPath("videos"),
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "PILIH FOLDER INI",
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
    lastOutputDir = res.filePaths[0];
    logLine("Folder hasil dipilih: " + lastOutputDir);
    return lastOutputDir;
  } catch (e) {
    logLine("Gagal membuka dialog folder: " + (e && e.message));
    return null;
  }
});

ipcMain.handle("kolosal:open-path", async (_event, target) => {
  try {
    if (typeof target !== "string" || target.length === 0 || target.length > 500) return false;
    const res = await shell.openPath(target); // "" = sukses
    if (res) logLine("Gagal membuka path: " + res);
    return !res;
  } catch {
    return false;
  }
});

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
      preload: path.join(__dirname, "preload.js"),
    },
  });
  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow.show();
  });
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
      showSplash("Menyiapkan server lokal…");
      const port = await getFreePort();
      logLine(`KolosalCut v${APP_VERSION} — memulai server di port ${port}`);
      prepareRuntime();
      startServer(port);
      await waitForPort(port, 120000); // ekstraksi pertama bisa memakan waktu
      closeSplash();
      createWindow(port);
    } catch (err) {
      closeSplash();
      const missing = missingModuleFrom(String((err && err.stack) || err) + "\n" + lastServerErr);
      showFatal(
        (err && err.message) || String(err),
        missing ? `Modul yang tidak ditemukan: ${missing}` : null
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
    closeSplash();
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
