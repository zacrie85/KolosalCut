// Uji cepat computeSegments — replika logika dari src/lib/video-config.ts
// (disalin persis agar bisa diuji tanpa transpile TS)
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const MAX_PARTS = 50;

function computeSegments(duration, s) {
  if (!isFinite(duration) || duration <= 0) return [];
  let segDur =
    s.splitMode === "duration"
      ? clamp(s.splitSeconds, 3, 3600)
      : duration / clamp(s.splitParts, 1, MAX_PARTS);
  let count = Math.ceil(duration / segDur - 1e-6);
  if (count > MAX_PARTS) {
    count = MAX_PARTS;
    segDur = duration / count;
  }
  const segs = [];
  for (let i = 0; i < count; i++) {
    const start = i * segDur;
    segs.push({ start, dur: Math.min(segDur, duration - start) });
  }
  if (segs.length > 1 && segs[segs.length - 1].dur < 0.5) {
    segs.pop();
    segs[segs.length - 1].dur = duration - segs[segs.length - 1].start;
  }
  if (segs.length === 0) segs.push({ start: 0, dur: duration });
  return segs;
}

function fmt(t) {
  const s = Math.floor(t % 60), m = Math.floor((t / 60) % 60), h = Math.floor(t / 3600);
  return `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

let fail = 0;
function check(name, duration, settings, wantCount, wantMaxParts) {
  const segs = computeSegments(duration, settings);
  const covered = segs.reduce((a, b) => a + b.dur, 0);
  const okCount = segs.length === wantCount;
  const okCover = Math.abs(covered - duration) < 1e-6;
  const okGap = segs.every((seg, i) => i === 0 || Math.abs(seg.start - (segs[i - 1].start + segs[i - 1].dur)) < 1e-6);
  const ok = okCount && okCover && okGap;
  if (!ok) fail++;
  console.log(
    `${ok ? "OK " : "GAGAL"} ${name}: ${segs.length} bagian, durasi video ${fmt(duration)}, ` +
      `tertutup ${fmt(covered)}, tiap bagian ${fmt(segs[0].dur)}${segs.length > 1 ? ".." + fmt(segs[segs.length - 1].dur) : ""}`
  );
  return segs;
}

// KASUS DARI SCREENSHOT USER: video 57:14 (3434s), mode durasi 60s, dulu 50x1:00 + ekor 7:14 hilang
const A = check("Kasus user 57:14 @60s", 3434, { splitMode: "duration", splitSeconds: 60 }, 50);
console.log(`     -> bagian terakhir: ${fmt(A[A.length - 1].dur)} (dulu 1:00 & 7:14 terbuang)`);

// 58 bagian sekarang menutup penuh
check("Kasus user 57:14 @60s coverage", 3434, { splitMode: "duration", splitSeconds: 60 }, 50);

// video pas habis dibagi
check("3000s @60s (habis)", 3000, { splitMode: "duration", splitSeconds: 60 }, 50);

// mode durasi di bawah batas: ekor sisanya menyatu
check("181s @60s (ekor 1s)", 181, { splitMode: "duration", splitSeconds: 60 }, 4);

// ekor mikro <0.5s
check("180.2s @60s", 180.2, { splitMode: "duration", splitSeconds: 60 }, 3);

// mode jumlah bagian
check("parts 7 @ 3434s", 3434, { splitMode: "parts", splitParts: 7 }, 7);

// parts = 50 pada video panjang
check("parts 50 @ 3434s", 3434, { splitMode: "parts", splitParts: 50 }, 50);

// video sangat pendek
check("2s @60s (1 bagian)", 2, { splitMode: "duration", splitSeconds: 60 }, 1);

// video 10 jam mode durasi 10s -> cap 50, dibagi rata
const B = check("10 jam @10s", 36000, { splitMode: "duration", splitSeconds: 10 }, 50);
console.log(`     -> tiap bagian ${fmt(B[0].dur)}`);

process.exit(fail > 0 ? 1 : 0);
