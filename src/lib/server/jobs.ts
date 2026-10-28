import type { Settings } from "@/lib/video-config";

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface PartInfo {
  /** nama file output, mis. "Judul-Film-Part-1.mp4" */
  file: string;
  thumb: string;
  size: number;
  duration: number;
}

export interface Job {
  id: string;
  uploadId: string;
  uploadPath: string;
  originalName: string;
  title: string;
  settings: Settings;
  info: VideoInfo;
  status: "queued" | "processing" | "done" | "error";
  phase: string;
  progress: number;
  total: number;
  parts: PartInfo[];
  error?: string;
  createdAt: number;
  /** folder akhir tempat file MP4 hasil disimpan (null = folder bawaan aplikasi) */
  outDir?: string | null;
}

export interface JobPublic {
  id: string;
  status: Job["status"];
  phase: string;
  progress: number;
  total: number;
  parts: PartInfo[];
  error?: string;
  title: string;
  createdAt: number;
  /** folder akhir tempat file MP4 hasil disimpan (null = folder bawaan) */
  outDir?: string | null;
}

export function jobToPublic(j: Job): JobPublic {
  return {
    id: j.id,
    status: j.status,
    phase: j.phase,
    progress: j.progress,
    total: j.total,
    parts: j.parts,
    error: j.error,
    title: j.title,
    createdAt: j.createdAt,
    outDir: j.outDir ?? null,
  };
}

// simpan di globalThis agar bertahan saat HMR dev server
const g = globalThis as unknown as { __kolosalJobs?: Map<string, Job> };
export const jobStore: Map<string, Job> = (g.__kolosalJobs ??= new Map());
