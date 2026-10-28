"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderUp, Files } from "lucide-react";
import { HudCorners } from "@/components/kolosal/hud";

export const MAX_VIDEOS = 50;
export const MAX_SIZE = 500 * 1024 * 1024;

interface ImportZoneProps {
  /** jumlah video yang sudah ada di antrean */
  total: number;
  onFiles: (files: File[]) => void;
}

/**
 * Area impor batch — pilih banyak video sekaligus (maks 50) atau
 * seret & lepas beberapa file sekaligus.
 */
export function ImportZone({ total, onFiles }: ImportZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const sisa = Math.max(0, MAX_VIDEOS - total);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={`glass rounded-xl border-2 border-dashed p-4 relative flex flex-col gap-2.5 text-center transition-all duration-300 ${
        dragOver
          ? "border-cyan-300 bg-cyan-400/10 shadow-[0_0_36px_-6px_rgba(34,211,238,0.65)]"
          : "border-cyan-300/30 hover:border-cyan-300/60"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handle(e.dataTransfer.files);
      }}
    >
      <HudCorners className={dragOver ? "opacity-100" : "opacity-60"} />
      <div className="flex items-center gap-3 text-left">
        <div className="rounded-lg bg-cyan-400/10 border border-cyan-300/35 p-2.5 shadow-[0_0_18px_-4px_rgba(34,211,238,0.7)] shrink-0">
          <FolderUp className="w-5 h-5 text-cyan-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-bold tracking-[0.14em] text-zinc-100">
            IMPOR VIDEO — MAKS {MAX_VIDEOS}
          </p>
          <p className="font-tech text-[10px] text-cyan-100/50 mt-0.5 tracking-wider">
            MP4, MOV, MKV, WEBM, AVI • 500MB/FILE • SISA SLOT {sisa}
          </p>
        </div>
      </div>
      <Button
        type="button"
        disabled={sisa === 0}
        className="w-full h-9 bg-gradient-to-r from-cyan-500 to-indigo-400 hover:from-cyan-400 hover:to-indigo-300 text-slate-950 font-semibold text-xs shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:opacity-40"
        onClick={() => inputRef.current?.click()}
      >
        <Files className="w-4 h-4 mr-1.5" aria-hidden />
        {sisa === 0 ? "SLOT PENUH (50 VIDEO)" : "PILIH BEBERAPA VIDEO SEKALIGUS"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,video/*"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
        aria-label="Pilih beberapa file video"
      />
    </div>
  );
}
