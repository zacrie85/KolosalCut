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
  };
}

// simpan di globalThis agar bertahan saat HMR dev server
const g = globalThis as unknown as { __kolosalJobs?: Map<string, Job> };
export const jobStore: Map<string, Job> = (g.__kolosalJobs ??= new Map());
