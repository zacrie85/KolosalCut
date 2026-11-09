"use client";

// KolosalCut v1.4.3 - Pemilih BINGKAI JUDUL (10 gaya + tanpa bingkai)
// Pratinjau mini digambar dengan drawTitleFrame yang SAMA PERSIS dengan hasil
// export (WYSIWYG): contoh tulisan "JUDUL" duduk di dalam bingkai dan
// interior bingkai tetap kosong (latar video terlihat).

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { TITLE_FRAMES, drawTitleFrame } from "@/lib/kc-engine/titleFrames";
import type { TitleFrameId } from "@/lib/kc-engine/titleFrames";

/** Kanvas kecil: latar ala adegan video + bingkai + contoh tulisan judul */
function FrameThumb({ id }: { id: TitleFrameId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    // latar contoh: gradasi adegan sinematik (seperti video)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1b2a4a");
    g.addColorStop(0.55, "#3d2f63");
    g.addColorStop(1, "#0b0d14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,196,88,0.85)";
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.3, h * 0.14, 0, Math.PI * 2);
    ctx.fill();

    const title = "JUDUL";
    const sz = h * 0.34;
    const fh = sz * 2.1; // tinggi kotak bingkai
    const fw = w * 0.74; // lebar kotak bingkai
    const fx = w / 2 - fw / 2;
    const fy = h / 2 - fh / 2 + h * 0.05;
    drawTitleFrame(ctx, id, fx, fy, fw, fh);
    // contoh tulisan judul DI DALAM bingkai (bingkai digambar dulu, teks di atas)
    ctx.font = `900 ${sz}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, sz * 0.14);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineJoin = "round";
    ctx.strokeText(title, w / 2, h / 2 + h * 0.05);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(title, w / 2, h / 2 + h * 0.05);
  }, [id]);
  return <canvas ref={ref} width={96} height={54} className="block h-auto w-full rounded-[3px]" />;
}

/** Grid pilihan bingkai judul — dipakai di menu TEKS KolosalCut */
export function TitleFramePicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {TITLE_FRAMES.map((f) => {
        const sel = (value || "") === f.id;
        return (
          <button
            key={f.id || "none"}
            type="button"
            disabled={disabled}
            onClick={() => onChange(f.id)}
            title={f.desc}
            className={`group relative overflow-hidden rounded-md border p-1 transition ${sel ? "border-cyan-300 bg-cyan-400/15 ring-1 ring-cyan-300/60" : "border-zinc-700 bg-white/[0.03] hover:border-cyan-400/40"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <FrameThumb id={f.id} />
            <div className="flex w-full items-center justify-center gap-0.5 overflow-hidden pt-0.5">
              {sel && <Check className="h-2.5 w-2.5 shrink-0 text-cyan-300" />}
              <span className={`truncate text-[10px] font-bold leading-none ${sel ? "text-cyan-100" : "text-zinc-400"}`}>{f.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
