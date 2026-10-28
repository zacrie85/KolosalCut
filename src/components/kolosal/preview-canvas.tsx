"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings,
  TextElement,
  BAR_H,
  getFrameStyle,
  getFont,
  FONT_OPTIONS,
  labelTextFor,
  maxCharsFor,
  wrapText,
  computeSegments,
  fmtDur,
} from "@/lib/video-config";
import { Button } from "@/components/ui/button";
import { Film, Play, Pause, SkipBack, SkipForward, Image as ImageIcon } from "lucide-react";

const CW = 540; // lebar kanvas internal
const CH = 960; // tinggi kanvas internal
const SC = CW / 1080;

type TextKey = "title" | "label" | "desc";

interface BBox {
  key: TextKey;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PreviewCanvasProps {
  videoUrl: string | null;
  duration: number;
  settings: Settings;
  onElementChange: (key: TextKey, el: Partial<TextElement>) => void;
  coverPreview: boolean;
  onCoverPreviewChange: (v: boolean) => void;
  partNum: number;
  onPartNumChange: (n: number) => void;
  seekReq: { t: number; k: number } | null;
  /** laporkan posisi putar ke luar (untuk playhead timeline) */
  onTimeChange?: (t: number) => void;
}

export function PreviewCanvas({
  videoUrl,
  duration,
  settings,
  onElementChange,
  coverPreview,
  onCoverPreviewChange,
  partNum,
  onPartNumChange,
  seekReq,
  onTimeChange,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bboxesRef = useRef<BBox[]>([]);
  const dragRef = useRef<{ key: TextKey; dx: number; dy: number } | null>(null);
  const hoverRef = useRef<TextKey | null>(null);
  const [cursor, setCursor] = useState<string>("default");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // gambar overlay frame (webp animasi neon / png minimalis) — digambar tiap frame,
  // sehingga animasi webp ikut bergerak di pratinjau
  const overlayRef = useRef<HTMLImageElement | null>(null);
  const overlayKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const style = getFrameStyle(settings.frame);
    if (!style.preview) {
      overlayRef.current = null;
      overlayKeyRef.current = null;
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = style.preview;
    img.onload = () => {
      overlayRef.current = img;
      overlayKeyRef.current = style.key;
    };
    return () => {
      img.onload = null;
    };
  }, [settings.frame]);

  // pastikan font bundel siap dipakai canvas
  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts) {
      FONT_OPTIONS.forEach((f) => {
        void document.fonts.load(`${f.weight} 40px "${f.css}"`);
      });
    }
  }, []);

  const reportTime = useCallback(
    (t: number) => {
      setTime(t);
      onTimeChange?.(t);
    },
    [onTimeChange]
  );

  // respons permintaan seek dari luar (chip bagian / timeline)
  useEffect(() => {
    if (seekReq && videoRef.current) {
      videoRef.current.currentTime = Math.min(seekReq.t, Math.max(0, duration - 0.1));
    }
  }, [seekReq, duration]);

  // saat mode cover dipilih, pindah ke waktu frame cover bagian aktif
  useEffect(() => {
    if (!videoRef.current || !duration) return;
    if (coverPreview) {
      const segs = computeSegments(duration, settings);
      const seg = segs[Math.min(partNum, segs.length) - 1];
      if (seg) {
        const frac = settings.coverPos === "tengah" ? 0.5 : 0.12;
        videoRef.current.currentTime = Math.max(0, seg.start + seg.dur * frac);
      }
    }
    // dependensi sengaja terbatas agar drag teks tidak memicu seek ulang
  }, [coverPreview, partNum, duration]);

  // ---- render utama ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CW, CH);

    const hasVideo = video && videoUrl && video.readyState >= 2 && video.videoWidth > 0;

    if (hasVideo) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      // posisi horizontal ambil gambar: 0 = kiri, 0.5 = tengah, 1 = kanan
      const panX = Math.min(1, Math.max(0, settings.panX));
      const drawCover = (scaleMul: number, usePan = true) => {
        const s = Math.max(CW / vw, CH / vh) * settings.zoom * scaleMul;
        const w = vw * s;
        const h = vh * s;
        ctx.drawImage(video, usePan ? (CW - w) * panX : (CW - w) / 2, (CH - h) / 2, w, h);
      };
      const drawContain = (scaleMul: number) => {
        const s = Math.min(CW / vw, CH / vh) * settings.zoom * scaleMul;
        const w = vw * s;
        const h = vh * s;
        ctx.drawImage(video, (CW - w) * panX, (CH - h) / 2, w, h);
      };

      if (settings.ratio === "full") {
        drawCover(1);
      } else {
        // latar blur (tetap tengah, hanya dekorasi)
        ctx.filter = "blur(22px) brightness(0.55) saturate(0.8)";
        drawCover(1.12, false);
        // video utama berisi — digeser sesuai posisi ambil
        ctx.filter = "none";
        drawContain(1);
      }
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#71717a";
      ctx.font = "600 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Unggah video untuk melihat pratinjau", CW / 2, CH / 2);
      ctx.textAlign = "left";
    }

    // bar sinema
    if (settings.bars && hasVideo) {
      const bar = BAR_H[settings.barSize] * SC;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CW, bar);
      ctx.fillRect(0, CH - bar, CW, bar);
    }

    // lapisan frame neon/minimalis (di atas bar, di bawah teks)
    const styleNow = getFrameStyle(settings.frame);
    if (hasVideo && styleNow.preview && overlayRef.current && overlayKeyRef.current === styleNow.key) {
      ctx.drawImage(overlayRef.current, 0, 0, CW, CH);
    }

    // ---- teks overlay ----
    const bboxes: BBox[] = [];
    const items: Array<{ key: TextKey; el: TextElement; text: string; style: "title" | "label" | "desc" }> = [];
    if (settings.title.enabled && settings.title.text.trim()) {
      items.push({ key: "title", el: settings.title, text: settings.title.text, style: "title" });
    }
    if (settings.label.enabled) {
      items.push({
        key: "label",
        el: settings.label,
        text: labelTextFor(settings, partNum),
        style: "label",
      });
    }
    if (settings.desc.enabled && settings.desc.text.trim()) {
      items.push({ key: "desc", el: settings.desc, text: settings.desc.text, style: "desc" });
    }

    for (const it of items) {
      const px = it.el.size * SC;
      const lines = wrapText(it.text, maxCharsFor(it.el.size));
      const fopt = getFont(it.el.font);
      ctx.font = `${fopt.weight} ${px}px "${fopt.css}", "KC Carlito", sans-serif`;
      ctx.textBaseline = "top";
      const lineH = px * 1.32;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 10);
      const blockH = lines.length * lineH;
      let cx = it.el.relX * CW; // pusat x
      let ty = it.el.relY * CH; // atas y
      cx = Math.min(Math.max(cx, widest / 2 + 9), CW - widest / 2 - 9);
      ty = Math.min(Math.max(ty, 9), CH - blockH - 9);
      const x0 = cx - widest / 2;

      const pad = 9;
      bboxes.push({ key: it.key, x: x0 - pad, y: ty - pad, w: widest + pad * 2, h: blockH + pad * 2 });

      lines.forEach((line, li) => {
        const ly = ty + li * lineH;
        const lw = ctx.measureText(line).width;
        const lx = cx - lw / 2;
        if (it.style === "desc") {
          ctx.fillStyle = "rgba(0,0,0,0.42)";
          ctx.fillRect(lx - pad, ly - pad * 0.4, lw + pad * 2, lineH + pad * 0.3);
        }
        ctx.shadowColor = it.style === "desc" ? "transparent" : "rgba(0,0,0,0.5)";
        ctx.shadowBlur = it.style === "desc" ? 0 : 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.lineWidth = Math.max(2, px * 0.055);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line, lx, ly);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = it.style === "label" ? "#F2C14E" : "#ffffff";
        ctx.fillText(line, lx, ly);
      });

      // sorot elemen yang disentuh
      const active = dragRef.current?.key === it.key || hoverRef.current === it.key;
      if (active) {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = "rgba(103,232,249,0.95)";
        ctx.shadowColor = "rgba(34,211,238,0.75)";
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;
        const bb = bboxes[bboxes.length - 1];
        ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
        ctx.restore();
      }
    }
    bboxesRef.current = bboxes;

    // garis bantu alignment saat menggeser teks (silang putus-putus)
    const dragKey = dragRef.current?.key;
    if (dragKey) {
      const bb = bboxes.find((b) => b.key === dragKey);
      if (bb) {
        ctx.save();
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = "rgba(103,232,249,0.55)";
        ctx.lineWidth = 1;
        const gcx = bb.x + bb.w / 2;
        const gcy = bb.y + bb.h / 2;
        ctx.beginPath();
        ctx.moveTo(gcx, 0);
        ctx.lineTo(gcx, CH);
        ctx.moveTo(0, gcy);
        ctx.lineTo(CW, gcy);
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [settings, partNum, videoUrl]);

  // loop gambar
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // ---- interaksi drag ----
  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CW,
      y: ((e.clientY - rect.top) / rect.height) * CH,
    };
  };

  const hitTest = (x: number, y: number): BBox | null => {
    const arr = bboxesRef.current;
    for (let i = arr.length - 1; i >= 0; i--) {
      const b = arr[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvas(e);
    const hit = hitTest(p.x, p.y);
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const el = settings[hit.key as TextKey];
      dragRef.current = { key: hit.key, dx: p.x - el.relX * CW, dy: p.y - el.relY * CH };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvas(e);
    if (dragRef.current) {
      const d = dragRef.current;
      const relX = Math.min(0.98, Math.max(0.02, (p.x - d.dx) / CW));
      const relY = Math.min(0.99, Math.max(0.01, (p.y - d.dy) / CH));
      onElementChange(d.key, { relX, relY });
    } else {
      const hit = hitTest(p.x, p.y);
      const next = hit ? hit.key : null;
      if (next !== hoverRef.current) hoverRef.current = next;
      setCursor(hit ? "grab" : "default");
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setCursor("default");
  };

  // ---- pemutar & navigasi bagian ----
  const segs = duration > 0 ? computeSegments(duration, settings) : [];

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const seekTo = (t: number) => {
    const clamped = Math.max(0, Math.min(t, Math.max(0, duration - 0.05)));
    if (videoRef.current) videoRef.current.currentTime = clamped;
    reportTime(clamped);
  };

  const gotoPart = (n: number) => {
    if (segs.length === 0) return;
    const next = Math.min(Math.max(n, 1), segs.length);
    const changed = next !== partNum;
    onPartNumChange(next);
    if (coverPreview && changed) {
      // efek coverPreview akan menangani seek otomatis (partNum ada di dependensinya)
      return;
    }
    seekTo(segs[next - 1].start + 0.05);
  };

  const iconBtn =
    "h-8 w-8 p-0 rounded-lg border border-cyan-300/25 bg-slate-950/60 text-zinc-300 hover:bg-cyan-400/10 hover:text-cyan-200 hover:border-cyan-300/60 disabled:opacity-40 transition-colors";

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* label monitor */}
      <div className="shrink-0 flex items-center justify-between font-tech text-[10px] tracking-[0.22em] px-3.5 pt-2.5 pb-1.5">
        <span className="flex items-center gap-1.5 text-cyan-300/90">
          <span className="led w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" aria-hidden />
          {playing ? "PLAYING" : "LIVE PREVIEW"}
        </span>
        <span className="text-zinc-500">MONITOR // 01</span>
      </div>

      {/* area kanvas — memenuhi tinggi stage, rasio 9:16 terjaga */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center px-3">
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="block max-h-full max-w-full w-auto h-auto rounded-lg border border-cyan-300/25 bg-black shadow-[0_0_34px_-8px_rgba(34,211,238,0.45),0_24px_48px_-24px_rgba(2,8,23,0.9)] touch-none select-none"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="Pratinjau video 9:16"
        />
        {!videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Film className="w-10 h-10 text-cyan-200/25" aria-hidden />
          </div>
        )}
      </div>

      {/* ---- player bar ala monitor referensi ---- */}
      <div className="shrink-0 border-t border-cyan-300/12 bg-slate-950/55 backdrop-blur px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[11px] tabular-nums text-cyan-200/90 w-10">
            {fmtDur(time)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.05}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={!videoUrl}
            className="kolosal-range flex-1"
            aria-label="Geser posisi video"
          />
          <span className="font-tech text-[11px] tabular-nums text-zinc-400 w-10 text-right">
            {fmtDur(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={segs.length === 0}
            className={iconBtn}
            aria-label="Bagian sebelumnya"
            onClick={() => gotoPart(partNum - 1)}
          >
            <SkipBack className="w-4 h-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!videoUrl}
            onClick={togglePlay}
            aria-label={playing ? "Jeda" : "Putar"}
            className="h-8 w-8 p-0 rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.45)] border-0"
          >
            {playing ? (
              <Pause className="w-4 h-4" aria-hidden />
            ) : (
              <Play className="w-4 h-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={segs.length === 0}
            className={iconBtn}
            aria-label="Bagian berikutnya"
            onClick={() => gotoPart(partNum + 1)}
          >
            <SkipForward className="w-4 h-4" aria-hidden />
          </Button>

          <span className="font-tech text-[10px] tracking-wider text-zinc-400 ml-1 whitespace-nowrap">
            BAGIAN {partNum}
            {segs.length > 0 && ` / ${segs.length}`}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <p className="hidden xl:block text-[10px] text-zinc-500 leading-tight max-w-[230px] text-right">
              Klik &amp; geser teks langsung di pratinjau — bebas semua arah.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!videoUrl}
              aria-pressed={coverPreview}
              onClick={() => onCoverPreviewChange(!coverPreview)}
              className={`h-8 px-2.5 rounded-lg font-tech text-[10px] tracking-wider border transition-colors ${
                coverPreview
                  ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-200 shadow-[0_0_14px_-3px_rgba(34,211,238,0.7)]"
                  : "border-cyan-300/25 bg-slate-950/60 text-zinc-300 hover:bg-cyan-400/10 hover:text-cyan-200"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 mr-1" aria-hidden />
              COVER
            </Button>
          </div>
        </div>
      </div>

      <video
        ref={videoRef}
        src={videoUrl ?? undefined}
        className="hidden"
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => reportTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
