"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings,
  TextElement,
  BAR_H,
  getPreset,
  labelTextFor,
  maxCharsFor,
  wrapText,
  computeSegments,
  fmtDur,
} from "@/lib/video-config";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Film } from "lucide-react";
import { HudCorners } from "@/components/kolosal/hud";

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
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bboxesRef = useRef<BBox[]>([]);
  const dragRef = useRef<{ key: TextKey; dx: number; dy: number } | null>(null);
  const hoverRef = useRef<TextKey | null>(null);
  const [cursor, setCursor] = useState<string>("default");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // respons permintaan seek dari luar (chip bagian)
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

    const preset = getPreset(settings.preset);
    const hasVideo = video && videoUrl && video.readyState >= 2 && video.videoWidth > 0;

    if (hasVideo) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cssFilter = preset.css === "none" ? "none" : preset.css;
      const drawCover = (scaleMul: number) => {
        const s = Math.max(CW / vw, CH / vh) * settings.zoom * scaleMul;
        const w = vw * s;
        const h = vh * s;
        ctx.drawImage(video, (CW - w) / 2, (CH - h) / 2, w, h);
      };
      const drawContain = (scaleMul: number) => {
        const s = Math.min(CW / vw, CH / vh) * settings.zoom * scaleMul;
        const w = vw * s;
        const h = vh * s;
        ctx.drawImage(video, (CW - w) / 2, (CH - h) / 2, w, h);
      };

      if (settings.ratio === "full") {
        ctx.filter = cssFilter;
        drawCover(1);
      } else {
        // latar blur
        ctx.filter = `${cssFilter === "none" ? "" : cssFilter} blur(22px) brightness(0.55) saturate(0.8)`;
        drawCover(1.12);
        // video utama berisi
        ctx.filter = cssFilter;
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

    // vinyet
    if (preset.vignette && hasVideo) {
      const grad = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.28, CW / 2, CH / 2, CH * 0.62);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);
    }

    // bar sinema
    if (settings.bars && hasVideo) {
      const bar = BAR_H[settings.barSize] * SC;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CW, bar);
      ctx.fillRect(0, CH - bar, CW, bar);
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
      ctx.font = `700 ${px}px "Carlito", "DejaVu Sans", sans-serif`;
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

  // ---- scrubber ----
  const onSeek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    setTime(t);
  };

  const segs = duration > 0 ? computeSegments(duration, settings) : [];

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="w-full max-w-[340px] sm:max-w-[380px] flex flex-col">
        {/* label monitor */}
        <div className="flex items-center justify-between font-tech text-[10px] tracking-[0.22em] px-0.5 pb-1.5">
          <span className="flex items-center gap-1.5 text-cyan-300/90">
            <span className="led w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" aria-hidden />
            LIVE PREVIEW
          </span>
          <span className="text-zinc-500">MONITOR // 01</span>
        </div>
        <div
          className="relative rounded-xl overflow-hidden border border-cyan-300/25 bg-black shadow-[0_0_34px_-8px_rgba(34,211,238,0.45),0_24px_48px_-24px_rgba(2,8,23,0.9)]"
        >
          <HudCorners />
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            className="w-full aspect-[9/16] touch-none select-none"
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
      </div>

      {/* kontrol bawah */}
      <div className="w-full max-w-[380px] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-zinc-400 w-9">{fmtDur(time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.05}
            value={Math.min(time, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={!videoUrl}
            className="kolosal-range flex-1"
            aria-label="Geser posisi video"
          />
          <span className="text-[11px] tabular-nums text-zinc-400 w-9 text-right">
            {fmtDur(duration)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="cover-preview"
              checked={coverPreview}
              onCheckedChange={onCoverPreviewChange}
              disabled={!videoUrl}
            />
            <Label htmlFor="cover-preview" className="text-xs text-zinc-300 cursor-pointer">
              Pratinjau cover
            </Label>
          </div>
          <span className="text-[11px] text-zinc-500">Bagian {partNum}</span>
        </div>

        {segs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto kolosal-scroll pr-1">
            {segs.map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant={partNum === i + 1 ? "default" : "outline"}
                className="h-7 px-2.5 text-[11px] rounded-full"
                onClick={() => {
                  onPartNumChange(i + 1);
                  if (coverPreview) {
                    // efek coverPreview akan menangani seek
                    onCoverPreviewChange(false);
                    setTimeout(() => onCoverPreviewChange(true), 0);
                  } else {
                    if (videoRef.current)
                      videoRef.current.currentTime = Math.max(0, segs[i].start + 0.05);
                  }
                }}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-zinc-500 leading-snug">
          Tips: <span className="text-zinc-300">klik & geser teks langsung di pratinjau</span> —
          bebas ke atas, bawah, kiri, dan kanan. Atur posisi juga lewat pad geser di panel
          pengaturan.
        </p>
      </div>

      <video
        ref={videoRef}
        src={videoUrl ?? undefined}
        className="hidden"
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {/* kontrol play/pos via tombol kecil */}
      <button
        className="sr-only"
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) void v.play();
          else v.pause();
        }}
        aria-hidden
        tabIndex={-1}
      />
      <span className="sr-only">{playing ? "memutar" : "berhenti"}</span>
    </div>
  );
}
