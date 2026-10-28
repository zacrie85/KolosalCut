"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileVideo, X } from "lucide-react";
import { fmtDur } from "@/lib/video-config";
import { HudCorners } from "@/components/kolosal/hud";

export interface UploadResult {
  uploadId: string;
  originalName: string;
  title: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

interface UploadZoneProps {
  uploaded: UploadResult | null;
  onUploaded: (info: UploadResult, objectUrl: string) => void;
  onCleared: () => void;
  onError: (msg: string) => void;
  /**
   * stage = untuk area pratinjau besar (dropzone saat kosong, hilang saat terisi)
   * card  = untuk panel kanan (kartu info video saat terisi, hilang saat kosong)
   * kosong = perilaku lama (dropzone/kartu di tempat yang sama)
   */
  variant?: "stage" | "card";
}

export function UploadZone({ uploaded, onUploaded, onCleared, onError, variant }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const doUpload = useCallback(
    (file: File) => {
      if (busy) return;
      if (file.size > 500 * 1024 * 1024) {
        onError("Ukuran video melebihi 500MB.");
        return;
      }
      setBusy(true);
      setProgress(0);
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 96));
      };
      xhr.onload = () => {
        setBusy(false);
        setProgress(100);
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            onUploaded(res as UploadResult, URL.createObjectURL(file));
          } else {
            onError(res.error ?? "Gagal mengunggah video.");
          }
        } catch {
          onError("Respons server tidak valid.");
        }
      };
      xhr.onerror = () => {
        setBusy(false);
        onError("Koneksi terputus saat mengunggah.");
      };
      xhr.send(form);
    },
    [busy, onUploaded, onError]
  );

  if (uploaded) {
    if (variant === "stage") return null;
    return (
      <div className="glass rounded-xl p-4 relative flex flex-col gap-3">
        <HudCorners />
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-cyan-400/10 border border-cyan-300/30 p-2 shadow-[0_0_14px_-4px_rgba(34,211,238,0.6)]">
            <FileVideo className="w-5 h-5 text-cyan-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100 truncate" title={uploaded.originalName}>
              {uploaded.originalName}
            </p>
            <p className="font-tech text-[11px] text-cyan-100/50 mt-0.5 tabular-nums">
              {fmtDur(uploaded.duration)} • {uploaded.width}×{uploaded.height} •{" "}
              {(uploaded.size / 1024 / 1024).toFixed(1)} MB • {uploaded.hasAudio ? "beraudio" : "tanpa audio"}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-zinc-400 hover:text-cyan-200"
            onClick={onCleared}
            aria-label="Ganti video"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full h-9 border-cyan-300/30 text-cyan-200 hover:bg-cyan-400/10 hover:border-cyan-300/60 font-tech tracking-wider text-xs"
          onClick={() => inputRef.current?.click()}
        >
          GANTI VIDEO
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doUpload(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (variant === "card") return null;

  return (
    <div
      className={`glass rounded-xl border-2 border-dashed p-6 relative flex flex-col items-center gap-3 text-center transition-all duration-300 ${
        dragOver
          ? "border-cyan-300 bg-cyan-400/10 shadow-[0_0_36px_-6px_rgba(34,211,238,0.65)]"
          : "border-cyan-300/30 hover:border-cyan-300/70"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) doUpload(f);
      }}
    >
      <HudCorners className={dragOver ? "opacity-100" : "opacity-60"} />
      <div className="relative rounded-full bg-cyan-400/10 border border-cyan-300/35 p-3.5 shadow-[0_0_22px_-4px_rgba(34,211,238,0.7)]">
        <UploadCloud className="w-7 h-7 text-cyan-300" aria-hidden />
      </div>
      <div>
        <p className="font-display text-xs font-bold tracking-[0.16em] text-zinc-100">
          TARIK &amp; LEPAS VIDEO KE SINI
        </p>
        <p className="font-tech text-[11px] text-cyan-100/50 mt-1.5">
          MP4, MOV, MKV, WebM, AVI — MAKS 500MB
        </p>
      </div>
      {busy ? (
        <div className="w-full max-w-[240px] flex flex-col gap-1.5">
          <Progress value={progress} className="h-2" />
          <p className="font-tech text-[11px] text-cyan-200/80 tabular-nums">
            MENGUNGGAH... {progress}%
          </p>
        </div>
      ) : (
        <Button
          className="bg-gradient-to-r from-cyan-500 to-indigo-400 hover:from-cyan-400 hover:to-indigo-300 text-slate-950 font-semibold shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          onClick={() => inputRef.current?.click()}
        >
          Pilih File Video
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) doUpload(f);
          e.target.value = "";
        }}
        aria-label="Pilih file video"
      />
    </div>
  );
}
