"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadZone } from "@/components/kolosal/upload-zone";
import { ImportZone, MAX_VIDEOS, MAX_SIZE } from "@/components/kolosal/import-zone";
import { uploadVideo, fmtSize, type UploadResult } from "@/lib/upload-client";
import { PreviewCanvas } from "@/components/kolosal/preview-canvas";
import { SettingsPanel } from "@/components/kolosal/settings-panel";
import { ExportPanel } from "@/components/kolosal/export-panel";
import { ResultPanel, type KcResultFile } from "@/components/kolosal/result-panel";
import { Timeline } from "@/components/kolosal/timeline";
import {
  DEFAULT_SETTINGS,
  PARALLEL_OPTIONS,
  Settings,
  TextElement,
  computeSegments,
  fmtDur,
  getFrameStyle,
  titleFromFilename,
} from "@/lib/video-config";
// v1.4.0: SELURUH pengolahan video kini MESIN NOVACUT (WebCodecs) di sisi aplikasi.
// Modul mesin hanya boleh dimuat di browser (menyentuh document/canvas) —
// karena itu di-import DINAMIS di handler, bukan statis di kepala berkas.
type KcModule = typeof import("@/lib/kc-bridge");
type KcItem = import("@/lib/kc-bridge").KcItem;
let kcMod: Promise<KcModule> | null = null;
function getKc(): Promise<KcModule> {
  kcMod ??= import("@/lib/kc-bridge");
  return kcMod;
}
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clapperboard,
  UploadCloud,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Film,
  Layers,
  Trash2,
} from "lucide-react";
import { HudCorners } from "@/components/kolosal/hud";
import { useToast } from "@/hooks/use-toast";

type ItemStatus =
  | "mengunggah"
  | "gagal-unggah"
  | "siap"
  | "antre"
  | "proses"
  | "selesai"
  | "gagal"
  | "batal";

interface QueueItem {
  uid: string;
  file: File | null;
  name: string;
  size: number;
  objectUrl: string;
  status: ItemStatus;
  uploadProgress: number;
  uploadId?: string;
  info?: UploadResult;
  /** progres render mesin NOVACUT (0..1) */
  kcProgress?: number;
  /** keterangan fase render (dari label mesin) */
  kcPhase?: string;
  /** hasil render video ini (isi saat status selesai/gagal) */
  result?: {
    status: "done" | "error";
    error?: string;
    outDir?: string;
    parts: KcResultFile[];
  };
  settings: Settings;
}

function cloneSettings(s: Settings): Settings {
  return JSON.parse(JSON.stringify(s)) as Settings;
}

/** folder induk dari sebuah path file (Windows/Unix) */
function dirNameOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : p;
}

/** unggah satu file dengan laporan progres (XHR streaming — aman untuk 10GB) */
function uploadOne(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
  return uploadVideo(file, onProgress);
}

const STATUS_META: Record<ItemStatus, { label: string; cls: string }> = {
  mengunggah: { label: "MENGUNGGAH", cls: "text-cyan-200 border-cyan-300/40 bg-cyan-400/10" },
  "gagal-unggah": { label: "GAGAL UNGGAH", cls: "text-red-300 border-red-400/40 bg-red-500/10" },
  siap: { label: "SIAP", cls: "text-zinc-300 border-zinc-600 bg-zinc-800/60" },
  antre: { label: "ANTRE", cls: "text-indigo-200 border-indigo-400/40 bg-indigo-500/10" },
  proses: { label: "MERENDER", cls: "text-cyan-200 border-cyan-300/50 bg-cyan-400/15" },
  selesai: { label: "SELESAI", cls: "text-emerald-200 border-emerald-400/40 bg-emerald-500/10" },
  gagal: { label: "GAGAL", cls: "text-red-300 border-red-400/50 bg-red-500/15" },
  batal: { label: "DIBATALKAN", cls: "text-zinc-300 border-zinc-500/50 bg-zinc-600/20" },
};

export default function Home() {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [starting, setStarting] = useState(false);
  const [coverPreview, setCoverPreview] = useState(false);
  const [partNum, setPartNum] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekReq, setSeekReq] = useState<{ t: number; k: number } | null>(null);

  const itemsRef = useRef<QueueItem[]>([]);
  const settingsRef = useRef<Settings>(settings);
  const selectedRef = useRef<string | null>(null);
  const uploadLoopRef = useRef(false);
  const uidRef = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  // muat folder hasil yang tersimpan dari sesi sebelumnya
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kolosalcut.outputDir");
      if (saved) setSettings((s) => ({ ...s, outputDir: saved }));
    } catch {
      /* penyimpanan lokal tidak tersedia — abaikan */
    }
  }, []);
  // v1.3.6: muat hasil tombol OPTIMALKAN dari sesi sebelumnya (paralel & kualitas)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kolosalcut.tuned");
      if (!raw) return;
      const t = JSON.parse(raw) as { quality?: string; parallel?: number };
      // v1.4.3: setelan OPTIMALKAN lama yang masih default 2 dinaikkan ke 4 —
      // export & split kini 2x lebih cepat; anggaran RAM tetap menjaga memori
      // v1.4.4: semua setelan OPTIMALKAN lama (2/3/4) dinaikkan ke 5 — setara
      // NOVACUT Studio v1.0.22 yang memenangkan benchmark render paralel
      const tp = Number(t.parallel);
      const tunedParallel = tp >= 2 && tp <= 4 ? 5 : tp;
      setSettings((s) => ({
        ...s,
        ...(t.quality === "fast" || t.quality === "balanced" || t.quality === "high"
          ? { quality: t.quality as Settings["quality"] }
          : {}),
        ...(PARALLEL_OPTIONS.includes(tunedParallel as Settings["parallel"])
          ? { parallel: tunedParallel as Settings["parallel"] }
          : {}),
      }));
    } catch {
      /* data tidak valid — abaikan */
    }
  }, []);
  useEffect(() => {
    selectedRef.current = selectedUid;
  }, [selectedUid]);

  const selected = items.find((i) => i.uid === selectedUid) ?? null;

  // saat memilih item, muat snapshot setelannya ke panel
  useEffect(() => {
    const it = items.find((i) => i.uid === selectedUid);
    if (it) setSettings(cloneSettings(it.settings));
  }, [selectedUid]);

  // setiap perubahan panel disimpan balik ke snapshot item terpilih (yang belum diproses)
  useEffect(() => {
    if (!selectedUid) return;
    setItems((prev) =>
      prev.map((it) =>
        it.uid === selectedUid && it.status === "siap" ? { ...it, settings: cloneSettings(settings) } : it
      )
    );
  }, [settings, selectedUid]);

  // ==================== ANTREAN UNGGAH ====================
  const flushUploads = useCallback(async () => {
    if (uploadLoopRef.current) return;
    uploadLoopRef.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find(
          (i) => i.status === "mengunggah" && !i.uploadId && i.file
        );
        if (!next) break;
        try {
          const res = await uploadOne(next.file!, (pct) => {
            setItems((prev) =>
              prev.map((i) => (i.uid === next.uid ? { ...i, uploadProgress: pct } : i))
            );
          });
          setItems((prev) =>
            prev.map((i) =>
              i.uid === next.uid
                ? {
                    ...i,
                    uploadId: res.uploadId,
                    info: res,
                    size: res.size,
                    status: "siap",
                    uploadProgress: 100,
                  }
                : i
            )
          );
        } catch (e) {
          setItems((prev) =>
            prev.map((i) => (i.uid === next.uid ? { ...i, status: "gagal-unggah" } : i))
          );
          toast({
            title: `Gagal unggah: ${next.name}`,
            description: (e as Error).message,
            variant: "destructive",
          });
        }
      }
    } finally {
      uploadLoopRef.current = false;
    }
  }, [toast]);

  // pompa antrean unggah SETELAH daftar ter-commit.
  // FIX race: dulu flushUploads dipanggil langsung dari addFiles, saat itemsRef
  // masih berisi daftar lama, sehingga unggahan batch tidak pernah dimulai
  // (status mentok MENGUNGGAH 0%). Dengan efek ini, setiap item "mengunggah"
  // dijamin diambil begitu daftar berubah — termasuk unggahan yang sempat nyangkut.
  useEffect(() => {
    void flushUploads();
  }, [items, flushUploads]);

  const addFiles = useCallback(
    (files: File[]) => {
      const slot = MAX_VIDEOS - itemsRef.current.length;
      if (slot <= 0) {
        toast({
          title: "Antrean penuh",
          description: `Maksimal ${MAX_VIDEOS} video dalam antrean.`,
          variant: "destructive",
        });
        return;
      }
      const added: QueueItem[] = [];
      let skipped = 0;
      for (const f of files.slice(0, slot)) {
        if (f.size > MAX_SIZE) {
          skipped++;
          continue;
        }
        const snap = cloneSettings(settingsRef.current);
        snap.title.text = titleFromFilename(f.name);
        uidRef.current += 1;
        added.push({
          uid: `v${uidRef.current}`,
          file: f,
          name: f.name,
          size: f.size,
          objectUrl: URL.createObjectURL(f),
          status: "mengunggah",
          uploadProgress: 0,
          settings: snap,
        });
      }
      if (skipped > 0) {
        toast({
          title: "Sebagian file dilewati",
          description: `${skipped} file melebihi batas ${fmtSize(MAX_SIZE)}.`,
          variant: "destructive",
        });
      }
      if (added.length === 0) return;
      setItems((prev) => [...prev, ...added]);
      if (!selectedRef.current) setSelectedUid(added[0].uid);
      // pompa unggahan kini lewat efek [items] di atas — tidak dipanggil langsung di sini
      toast({
        title: "Video ditambahkan",
        description: `${added.length} video masuk antrean & sedang diunggah.`,
      });
    },
    [flushUploads, toast]
  );

  const onSingleUploaded = useCallback(
    (info: UploadResult, objectUrl: string, file?: File) => {
      const snap = cloneSettings(settingsRef.current);
      snap.title.text = info.title;
      uidRef.current += 1;
      const item: QueueItem = {
        uid: `v${uidRef.current}`,
        file: file ?? null,
        name: info.originalName,
        size: info.size,
        objectUrl,
        status: "siap",
        uploadProgress: 100,
        uploadId: info.uploadId,
        info,
        settings: snap,
      };
      setItems((prev) => [...prev, item]);
      if (!selectedRef.current) setSelectedUid(item.uid);
      toast({
        title: "Video siap",
        description: `${info.originalName} — ${fmtDur(info.duration)}`,
      });
    },
    [toast]
  );

  const removeItem = useCallback(
    (uid: string) => {
      const it = itemsRef.current.find((i) => i.uid === uid);
      if (!it) return;
      if (it.status === "antre" || it.status === "proses") return;
      URL.revokeObjectURL(it.objectUrl);
      setItems((prev) => prev.filter((i) => i.uid !== uid));
      if (selectedRef.current === uid) setSelectedUid(null);
    },
    []
  );

  const clearFinished = useCallback(() => {
    const done = itemsRef.current.filter(
      (i) => i.status === "selesai" || i.status === "gagal" || i.status === "batal"
    );
    done.forEach((i) => URL.revokeObjectURL(i.objectUrl));
    const ids = new Set(done.map((i) => i.uid));
    setItems((prev) => prev.filter((i) => !ids.has(i.uid)));
    if (done.length > 0) {
      toast({ title: "Dibersihkan", description: `${done.length} video selesai dihapus dari daftar.` });
    }
  }, [toast]);

  // ==================== AKSI ====================
  const onElementChange = useCallback((key: string, el: Partial<TextElement>) => {
    setSettings((s) => ({
      ...s,
      [key]: { ...(s[key as "title" | "label" | "desc"] as TextElement), ...el },
    }));
  }, []);

  const onSettingsChange = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    // folder hasil dipersist agar tidak hilang saat aplikasi ditutup
    if (typeof patch.outputDir === "string") {
      try {
        if (patch.outputDir) localStorage.setItem("kolosalcut.outputDir", patch.outputDir);
        else localStorage.removeItem("kolosalcut.outputDir");
      } catch {
        /* penyimpanan lokal tidak tersedia — abaikan */
      }
    }
  }, []);

  const applyToAll = useCallback(() => {
    let n = 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.status !== "siap") return it; // yang sudah/sedang diproses tidak diubah
        n++;
        const ns = cloneSettings(settingsRef.current);
        // judul tetap otomatis dari nama file masing-masing video
        ns.title = { ...ns.title, text: it.settings.title.text };
        return { ...it, settings: ns };
      })
    );
    if (n === 0) {
      toast({ title: "Tidak ada video yang bisa disetel", description: "Semua video sudah diproses." });
      return;
    }
    toast({
      title: "Setelan diterapkan",
      description: `Setelan gaya, teks & potong diterapkan ke ${n} video (judul tetap otomatis dari nama file).`,
    });
  }, [toast]);

  const readyCount = items.filter((i) => i.uploadId && !i.result && i.status === "siap").length;
  const busyCount = items.filter((i) => i.status === "antre" || i.status === "proses").length;

  // ==================== MESIN RENDER NOVACUT (v1.4.0) ====================
  // Tidak ada lagi polling job server — mesin NOVACUT berjalan di aplikasi
  // dan melaporkan progres lewat subscription langsung.

  const startProcessAll = useCallback(async () => {
    const kc = await getKc();
    if (starting || kc.isKcBatchRunning()) return;
    const ready = itemsRef.current.filter(
      (i) => i.uploadId && !i.result && i.status === "siap" && i.file
    );
    if (ready.length === 0) {
      toast({
        title: "Belum ada video siap",
        description: "Tambahkan video dulu — file yang masih mengunggah belum bisa dirender.",
      });
      return;
    }
    setStarting(true);
    setCoverPreview(false);
    const kcItems: KcItem[] = ready.map((it) => ({
      id: it.uid,
      name: it.name,
      duration: it.info?.duration ?? 0,
      width: it.info?.width ?? 1080,
      height: it.info?.height ?? 1920,
      file: it.file!,
      objectUrl: it.objectUrl,
      uploadId: it.uploadId,
      settings: cloneSettings(it.settings),
    }));
    // tandai baris sebagai masuk antrean mesin
    setItems((prev) =>
      prev.map((it) =>
        ready.some((r) => r.uid === it.uid)
          ? { ...it, status: "antre", kcProgress: 0, kcPhase: "MENUNGGU...", result: undefined }
          : it
      )
    );
    try {
      await kc.startKcBatch(kcItems, settingsRef.current, (snap) => {
        const byId = new Map(snap.jobs.map((j) => [j.id, j]));
        setItems((prev) =>
          prev.map((it) => {
            const j = byId.get(it.uid);
            if (!j) return it;
            if (j.status === "selesai") {
              // hanya hasil milik video ini (atribusi kcJobId dari mesin)
              const own = snap.results.filter((r) => r.kcJobId === it.uid);
              const parts: KcResultFile[] = own.map((r) => ({
                file: r.name,
                size: r.size,
                duration: 0,
                ...(r.savedPath ? { savedPath: r.savedPath } : {}),
              }));
              const anySaved = parts.find((p) => p.savedPath);
              return {
                ...it,
                status: "selesai" as ItemStatus,
                kcProgress: 1,
                kcPhase: "SELESAI",
                result: {
                  status: "done" as const,
                  ...(anySaved?.savedPath ? { outDir: dirNameOf(anySaved.savedPath) } : {}),
                  parts,
                },
              };
            }
            if (j.status === "batal") {
              return { ...it, status: "batal" as ItemStatus, kcProgress: j.progress, kcPhase: "DIBATALKAN" };
            }
            if (j.status === "gagal") {
              return {
                ...it,
                status: "gagal" as ItemStatus,
                kcProgress: j.progress,
                kcPhase: j.label || "GAGAL",
                result: { status: "error" as const, error: j.label || "Render gagal", parts: [] },
              };
            }
            const status: ItemStatus = j.status === "jalan" ? "proses" : "antre";
            return {
              ...it,
              status,
              kcProgress: j.progress,
              kcPhase: (j.label || "MERENDER...").toUpperCase(),
            };
          })
        );
      });
      toast({
        title: "Render selesai",
        description: "Semua video yang dipilih telah diproses mesin NOVACUT.",
      });
    } catch (e) {
      toast({
        title: "Render terhenti",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  }, [starting, toast]);

  // ==================== PEMBATALAN (mesin NOVACUT, langsung) ====================
  const cancelJobById = useCallback(
    (uid: string) => {
      void getKc().then((kc) => kc.cancelKcBatch({ id: uid }));
      toast({ title: "Render dibatalkan", description: "Video ini dihentikan — bagian yang sudah selesai tetap tersimpan." });
    },
    [toast]
  );

  const cancelAllJobs = useCallback(() => {
    const running = itemsRef.current.filter(
      (i) => i.status === "antre" || i.status === "proses"
    );
    if (running.length === 0) return;
    void getKc().then((kc) => kc.cancelKcBatch({ all: true }));
    toast({
      title: "Semua render dibatalkan",
      description: `${running.length} video dihentikan — bagian yang sudah selesai tetap tersimpan.`,
    });
  }, [toast]);

  // ==================== PRATINJAU ====================
  const segs = useMemo(
    () => (selected?.info ? computeSegments(selected.info.duration, settings) : []),
    [selected, settings]
  );

  // pemberitahuan saat mode durasi melebihi 50 bagian: seluruh video dibagi rata
  const splitNotice = useMemo(() => {
    if (!selected?.info || settings.splitMode !== "duration") return "";
    const dur = selected.info.duration;
    const want = Math.ceil(dur / Math.max(3, Math.min(3600, settings.splitSeconds)) - 1e-6);
    if (want <= 50) return "";
    return (
      `Video ${fmtDur(dur)} butuh ${want} bagian — melebihi batas 50. ` +
      `Seluruh video otomatis dibagi rata menjadi 50 bagian (±${fmtDur(dur / 50)}) ` +
      `supaya tidak ada bagian video yang terpotong.`
    );
  }, [selected?.info, settings.splitMode, settings.splitSeconds]);

  const selectPart = useCallback(
    (i: number) => {
      setPartNum(i + 1);
      if (coverPreview) return;
      const seg = segs[i];
      if (seg) setSeekReq({ t: Math.max(0, seg.start + 0.05), k: Date.now() });
    },
    [coverPreview, segs]
  );

  const frameName = getFrameStyle(settings.frame).name;

  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-x-clip">
      {/* ===== LATAR BELAKANG HUD ===== */}
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_-8%,rgba(34,211,238,0.13),transparent_70%),radial-gradient(ellipse_55%_45%_at_105%_105%,rgba(129,140,248,0.11),transparent_70%)]" />
        <div className="orb anim-drift-a w-[420px] h-[420px] -top-24 -left-24 bg-cyan-500/25" />
        <div className="orb anim-drift-b w-[480px] h-[480px] top-1/3 -right-40 bg-indigo-500/20" />
        <div className="orb anim-drift-a w-[300px] h-[300px] bottom-0 left-1/3 bg-fuchsia-500/10" />
        <div className="absolute inset-0 grid-overlay" />
      </div>

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 border-b border-cyan-300/15 bg-slate-950/75 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center gap-3">
          <div className="relative rounded-lg bg-cyan-400/10 border border-cyan-300/40 p-2 shadow-[0_0_22px_rgba(34,211,238,0.4)]">
            <Clapperboard className="w-5 h-5 text-cyan-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-extrabold tracking-[0.14em] leading-none">
              KOLOSAL<span className="title-gradient">CUT</span>
            </h1>
            <p className="font-tech text-[10px] text-cyan-100/50 leading-tight mt-1 tracking-[0.18em] hidden sm:block">
              NEON VIDEO ENGINE // SPLIT STUDIO 9:16
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            <span className="font-tech text-[10px] tracking-wider rounded border border-teal-400/30 bg-teal-400/5 px-2.5 py-1.5 text-teal-200">
              v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
            </span>
            <span className="font-tech text-[10px] tracking-wider rounded border border-cyan-300/30 bg-cyan-400/5 px-2.5 py-1.5 text-cyan-200 flex items-center gap-1.5">
              <span className="led w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" aria-hidden />
              9:16 • 1080×1920
            </span>
            <span className="font-tech text-[10px] tracking-wider rounded border border-indigo-400/30 bg-indigo-400/5 px-2.5 py-1.5 text-indigo-200 flex items-center gap-1.5">
              <Layers className="w-3 h-3" aria-hidden />
              RENDER {settings.parallel}× PARALEL
            </span>
            <span className="font-tech text-[10px] tracking-wider rounded border border-fuchsia-400/30 bg-fuchsia-400/5 px-2.5 py-1.5 text-fuchsia-200">
              FRAME NEON &amp; MINIMALIS
            </span>
          </div>
        </div>
        <div className="h-px w-full data-stream opacity-70" aria-hidden />
      </header>

      {/* ===== KONTEN — LAYOUT EDITOR ===== */}
      <main className="app-editor-h flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-3 flex-1 lg:min-h-0 min-w-0">
          {/* ================= KOLOM KIRI: STAGE + TIMELINE ================= */}
          <div className="flex flex-col gap-3 lg:min-h-0 min-w-0">
            <div className="glass rounded-2xl relative overflow-hidden flex flex-col h-[70vh] min-h-[440px] lg:h-auto lg:flex-1 lg:min-h-0">
              <HudCorners />
              {items.length > 0 ? (
                <PreviewCanvas
                  videoUrl={selected?.objectUrl ?? null}
                  duration={selected?.info?.duration ?? 0}
                  settings={settings}
                  onElementChange={onElementChange}
                  coverPreview={coverPreview}
                  onCoverPreviewChange={setCoverPreview}
                  partNum={partNum}
                  onPartNumChange={setPartNum}
                  seekReq={seekReq}
                  onTimeChange={setCurrentTime}
                />
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6">
                  <div className="w-full max-w-md">
                    <UploadZone
                      variant="stage"
                      uploaded={null}
                      onUploaded={onSingleUploaded}
                      onCleared={() => {}}
                      onError={(m) =>
                        toast({ title: "Gagal unggah", description: m, variant: "destructive" })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <Timeline
              duration={selected?.info?.duration ?? 0}
              segs={segs}
              partNum={partNum}
              currentTime={currentTime}
              hasAudio={selected?.info?.hasAudio ?? false}
              caption={settings.desc.text.trim() || settings.title.text.trim()}
              presetName={frameName}
              onPartSelect={selectPart}
              notice={splitNotice}
            />
          </div>

          {/* ================= KOLOM KANAN ================= */}
          <aside className="flex flex-col gap-3 lg:min-h-0 min-w-0 lg:overflow-y-auto lg:kolosal-scroll lg:pr-1">
            {/* --- kartu antrean & impor --- */}
            <div className="glass rounded-2xl p-3 flex flex-col gap-2.5 shrink-0">
              <ImportZone total={items.length} onFiles={addFiles} />

              {items.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-1">
                    <p className="font-tech text-[10px] tracking-[0.18em] text-cyan-100/60">
                      ANTREAN — {items.length} VIDEO · {readyCount} SIAP · {busyCount} DIPROSES
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-zinc-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={clearFinished}
                      disabled={items.every((i) => i.status !== "selesai" && i.status !== "gagal")}
                    >
                      <Trash2 className="w-3 h-3 mr-1" aria-hidden />
                      BERSIHKAN
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto kolosal-scroll pr-1">
                    {items.map((it, idx) => {
                      const meta = STATUS_META[it.status];
                      const isSel = it.uid === selectedUid;
                      return (
                        <div
                          key={it.uid}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedUid(it.uid)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setSelectedUid(it.uid);
                          }}
                          className={`rounded-lg border p-2 cursor-pointer transition-colors ${
                            isSel
                              ? "border-cyan-300/60 bg-cyan-400/10"
                              : "border-zinc-800 bg-slate-950/60 hover:border-zinc-600"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-tech text-[10px] text-zinc-500 w-5 tabular-nums shrink-0 text-right">
                              {idx + 1}
                            </span>
                            {it.status === "proses" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300 shrink-0" />
                            ) : it.status === "selesai" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : it.status === "gagal" || it.status === "gagal-unggah" ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            ) : (
                              <Film className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            )}
                            <p
                              className="text-xs font-medium text-zinc-200 truncate flex-1 min-w-0"
                              title={it.name}
                            >
                              {it.name}
                            </p>
                            <span
                              className={`font-tech text-[9px] tracking-wider rounded border px-1.5 py-0.5 shrink-0 ${meta.cls}`}
                            >
                              {meta.label}
                            </span>
                            {/* v1.3.3: lencana teks otomatis aktif untuk video ini */}
                            {it.settings.subtitle.enabled && (
                              <span
                                title="Teks otomatis (suara → teks) aktif"
                                className="font-tech text-[9px] tracking-wider rounded border px-1.5 py-0.5 shrink-0 text-amber-200 border-amber-300/40 bg-amber-400/10"
                              >
                                TEKS
                              </span>
                            )}
                            {(it.status === "siap" ||
                              it.status === "gagal-unggah" ||
                              it.status === "mengunggah") && (
                              <button
                                type="button"
                                aria-label={`Hapus ${it.name}`}
                                className="shrink-0 rounded p-1 text-zinc-500 hover:text-red-300 hover:bg-red-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItem(it.uid);
                                }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {(it.status === "mengunggah" || it.status === "antre" || it.status === "proses") && (
                            <div className="mt-1.5 flex items-center gap-2 pl-7">
                              <Progress
                                value={
                                  it.status === "mengunggah"
                                    ? it.uploadProgress
                                    : Math.round((it.kcProgress ?? 0) * 100)
                                }
                                className="h-1.5 flex-1"
                              />
                              <span className="font-tech text-[9px] text-cyan-100/60 tabular-nums w-20 truncate">
                                {it.status === "mengunggah"
                                  ? `UNGGAH ${it.uploadProgress}%`
                                  : (it.kcPhase ?? "MENUNGGU...")}
                              </span>
                            </div>
                          )}
                          {(it.status === "siap" || it.info) && (
                            <p className="font-tech text-[9px] text-zinc-500 pl-7 mt-1 tabular-nums">
                              {it.info
                                ? `${fmtDur(it.info.duration)} • ${(it.size / 1024 / 1024).toFixed(1)} MB`
                                : `${(it.size / 1024 / 1024).toFixed(1)} MB`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* --- kartu pengaturan --- */}
            <div className="glass rounded-2xl p-3 flex flex-col gap-3 shrink-0">
              <SettingsPanel
                settings={settings}
                onChange={onSettingsChange}
                hasVideo={items.length > 0}
                videoWidth={selected?.info?.width}
                videoHeight={selected?.info?.height}
                videoUrl={selected?.objectUrl ?? null}
                videoDuration={selected?.info?.duration ?? 0}
              />
            </div>

            {/* --- MENU EKSPORT & SPLIT ala NOVACUT (v1.3.5) --- */}
            <ExportPanel
              settings={settings}
              onChange={onSettingsChange}
              items={items}
              starting={starting}
              onStart={() => void startProcessAll()}
              onCancelJob={cancelJobById}
              onCancelAll={cancelAllJobs}
            />

            {/* --- terapkan setelan ke semua --- */}
            <div className="glass rounded-2xl p-3 flex flex-col gap-2 shrink-0">
              <Button
                onClick={applyToAll}
                disabled={items.length === 0}
                variant="outline"
                className="w-full h-10 border-cyan-300/40 text-cyan-200 hover:bg-cyan-400/10 hover:border-cyan-300/70 font-tech tracking-wider text-xs disabled:opacity-40"
              >
                <Layers className="w-4 h-4 mr-1.5" aria-hidden />
                TERAPKAN SETELAN KE SEMUA
              </Button>
            </div>

            {/* --- hasil render per video (selesai / gagal saja; progres ada di panel EKSPORT) --- */}
            {items
              .filter((i) => i.result)
              .map((i) => (
                <div key={i.uid} className="flex flex-col gap-1 shrink-0">
                  <p className="font-tech text-[10px] tracking-[0.16em] text-cyan-100/60 px-1 flex items-center gap-1.5">
                    <UploadCloud className="w-3 h-3" aria-hidden />
                    {i.name}
                  </p>
                  <ResultPanel result={i.result ?? null} />
                </div>
              ))}
          </aside>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-cyan-300/12 bg-slate-950/70">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between">
          <p className="font-tech text-[10px] tracking-[0.2em] text-cyan-100/40">
            KOLOSALCUT // NOVACUT WEBCodecs ENGINE
          </p>
          <span className="font-tech text-[10px] tracking-[0.2em] hidden sm:block text-cyan-300/70">
            MESIN NOVACUT · 100% OFFLINE · TANPA WATERMARK
          </span>
        </div>
      </footer>
    </div>
  );
}
