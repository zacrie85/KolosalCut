// E2E v1.3.5 KolosalCut — efek NOVACUT + transisi + speed/loop + cover NOVACUT
// Jalankan: node scripts/e2e-v135.mjs  (server dev harus jalan di :3000)
import { readFileSync } from "fs";
import { execSync } from "child_process";

const BASE = "http://localhost:3111";
const SRC = "/tmp/kc-e2e/testsrc.mp4";
const A = "/tmp/kc-e2e";

const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const jpg64 = (p) => `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;

const baseSettings = {
  splitMode: "duration",
  splitSeconds: 5,
  splitParts: 3,
  coverEnabled: true,
  coverSame: false,
  coverDuration: 2,
  coverPos: "tengah",
  coverTemplate: "impact--cyber",
  coverMode: "auto",
  coverBg: "adegan",
  coverFrameStyle: "none",
  coverManualPlain: false,
  effects: [],
  transitionType: null,
  transitionDur: 0.6,
  speed: 1,
  loopCount: 1,
  title: { enabled: true, text: "Film Uji", relX: 0.5, relY: 0.055, size: 58, font: "anton" },
  label: { enabled: true, format: "part", prefix: "", text: "", relX: 0.5, relY: 0.14, size: 44, font: "montserrat" },
  desc: { enabled: false, text: "", relX: 0.5, relY: 0.86, size: 38, font: "carlito" },
  frame: "none",
  bars: true,
  barSize: "sedang",
  ratio: "full",
  zoom: 1,
  panX: 0.5,
  panY: 0.5,
  quality: "fast",
  parallel: 1,
  outputDir: "",
  subtitle: { enabled: false, mode: "cepat", style: "tiktok", posY: 0.75 },
};

function coverPayload(n) {
  return { coverOverlay: b64(`${A}/ov.png`), coverParts: Array.from({ length: n }, (_, i) => b64(`${A}/pt${i + 1}.png`)) };
}

async function uploadVideo() {
  const buf = readFileSync(SRC);
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { "x-file-name": encodeURIComponent("film-uji.mp4"), "Content-Type": "video/mp4" },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload gagal: ${res.status} ${await res.text()}`);
  return res.json();
}

async function startJob(settings, extra = {}) {
  const res = await fetch(`${BASE}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId: UP.uploadId,
      originalName: "film-uji.mp4",
      title: "Film Uji",
      settings,
      parallel: 1,
      ...extra,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`process gagal: ${JSON.stringify(data)}`);
  return data.jobId;
}

async function waitJob(id, label) {
  for (let i = 0; i < 240; i++) {
    const res = await fetch(`${BASE}/api/jobs?ids=${id}`);
    const { jobs } = await res.json();
    const j = jobs[0];
    if (j?.status === "done") return j;
    if (j?.status === "error") throw new Error(`${label} gagal: ${j.error}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label}: timeout`);
}

let UP;
async function main() {
  UP = await uploadVideo();
  console.log("upload OK:", UP.uploadId, `${UP.duration}s`, `${UP.width}x${UP.height}`, "audio:", UP.hasAudio);

  const results = {};

  // ---- JOB A: cover NOVACUT + efek + transisi flash ----
  {
    const s = { ...baseSettings, effects: ["grade-teal", "fx-vignette", "fx-grain"], transitionType: "flash", transitionDur: 0.6 };
    const id = await startJob(s, coverPayload(3));
    const j = await waitJob(id, "JOB A");
    results.A = j.parts.map((p) => p.duration);
    console.log("JOB A (cover+efek+transisi) OK — durasi:", results.A.join(", "), "dtk (harap ±6.4/6.4/5.4)");
  }

  // ---- JOB B: cover hitam + bingkai futuristik + speed 2 + loop 2 + kenburns ----
  {
    const s = {
      ...baseSettings,
      splitMode: "parts",
      splitParts: 2,
      coverTemplate: "neon--sunset",
      coverBg: "hitam",
      coverFrameStyle: "futuristik",
      coverDuration: 1,
      effects: ["fx-kenburns"],
      speed: 2,
      loopCount: 2,
    };
    const id = await startJob(s, coverPayload(2));
    const j = await waitJob(id, "JOB B");
    results.B = j.parts.map((p) => p.duration);
    console.log("JOB B (hitam+futuristik+speed2+loop2) OK — durasi:", results.B.join(", "), "dtk (harap ±8.0)");
  }

  // ---- JOB C: gambar manual apa adanya + template band--gold ----
  {
    const s = {
      ...baseSettings,
      coverTemplate: "band--gold",
      coverMode: "manual",
      coverImage: jpg64(`${A}/manual.jpg`),
      coverManualPlain: true,
      coverFrameStyle: "klasik",
      effects: ["fx-letterbox"],
      transitionType: "slideleft",
    };
    const id = await startJob(s, {});
    const j = await waitJob(id, "JOB C");
    results.C = j.parts.map((p) => p.duration);
    console.log("JOB C (manual plain+bingkai+letterbox+slide) OK — durasi:", results.C.join(", "), "dtk (harap ±6.6)");
  }

  console.log("E2E SEMUA JOB SELESAI ✔");
  console.log("HASIL:", JSON.stringify(results));
}

main().catch((e) => {
  console.error("E2E GAGAL:", e.message);
  process.exit(1);
});
