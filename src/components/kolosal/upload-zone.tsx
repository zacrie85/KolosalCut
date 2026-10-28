"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileVideo, X } from "lucide-react";
import { fmtDur } from "@/lib/video-config";

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
}

export function UploadZone({ uploaded, onUploaded, onCleared, onError }: UploadZoneProps) {
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
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
            <FileVideo className="w-5 h-5 text-amber-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100 truncate" title={uploaded.originalName}>
              {uploaded.originalName}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
              {fmtDur(uploaded.duration)} • {uploaded.width}×{uploaded.height} •{" "}
              {(uploaded.size / 1024 / 1024).toFixed(1)} MB • {uploaded.hasAudio ? "beraudio" : "tanpa audio"}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
            onClick={onCleared}
            aria-label="Ganti video"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full h-9 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          onClick={() => inputRef.current?.click()}
        >
          Ganti Video
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

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 text-center transition-colors ${
        dragOver
          ? "border-amber-400 bg-amber-500/5"
          : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500"
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
      <div className="rounded-full bg-amber-500/10 border border-amber-500/30 p-3">
        <UploadCloud className="w-7 h-7 text-amber-400" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-100">Tarik & lepas video ke sini</p>
        <p className="text-xs text-zinc-400 mt-1">
          MP4, MOV, MKV, WebM, AVI — maksimal 500MB
        </p>
      </div>
      {busy ? (
        <div className="w-full max-w-[240px] flex flex-col gap-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-[11px] text-zinc-400 tabular-nums">Mengunggah... {progress}%</p>
        </div>
      ) : (
        <Button
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold"
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
