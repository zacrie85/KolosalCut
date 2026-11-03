import type { Settings } from "@/lib/video-config";

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** v1.3.5: nama codec video asli (h264/hevc/...) — syarat MESIN KILAT */
  codec?: string;
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
  status: "queued" | "processing" | "done" | "error" | "canceled";
  phase: string;
  progress: number;
  total: number;
  parts: PartInfo[];
  error?: string;
  createdAt: number;
  /** folder akhir tempat file MP4 hasil disimpan (null = folder bawaan aplikasi) */
  outDir?: string | null;
  /** v1.3.5: PNG overlay cover ala NOVACUT (dataURL) — dipakai semua bagian */
  coverOverlay?: string | null;
  /** v1.3.5: PNG teks PART per bagian (dataURL, urut bagian 1..N) */
  coverParts?: string[];
  /** v1.3.5: permintaan batal dari pengguna — dicek antar bagian & membunuh ffmpeg */
  cancelRequested?: boolean;
  /** v1.3.5: mesin yang benar-benar dipakai ("kilat" / "penuh") — untuk ditampilkan */
  engineUsed?: "kilat" | "penuh";
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
  /** v1.3.5: mesin yang benar-benar dipakai — ditampilkan di panel hasil */
  engineUsed?: "kilat" | "penuh";
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
    engineUsed: j.engineUsed,
  };
}

// simpan di globalThis agar bertahan saat HMR dev server
const g = globalThis as unknown as { __kolosalJobs?: Map<string, Job> };
export const jobStore: Map<string, Job> = (g.__kolosalJobs ??= new Map());
