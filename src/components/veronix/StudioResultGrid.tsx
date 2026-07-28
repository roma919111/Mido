"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Pause,
  Pencil,
  Play,
  Share2,
} from "lucide-react";
import { veronixDownloadPath, veronixMediaSrc } from "@/lib/media-proxy";
import type { StudioJob } from "@/lib/studio-jobs";
import { writeEditDraft } from "@/lib/edit-draft";
import { fetchJson } from "@/lib/fetch-json";
import { useRouter } from "next/navigation";
import { GenerateClock } from "@/components/veronix/GenerateClock";

function ResultCard({
  job,
  prompt,
  onShare,
}: {
  job: StudioJob;
  prompt: string;
  onShare: (job: StudioJob) => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const waiting = job.status === "running";
  const failed = job.status === "failed";
  const clockStart =
    typeof job.startedAt === "number" && job.startedAt > 0
      ? job.startedAt
      : Date.now();
  const src =
    job.url && job.mediaType === "video"
      ? veronixMediaSrc({
          historyId: job.historyId,
          url: job.url,
          mediaType: "video",
        })
      : null;
  const imgSrc =
    job.url && job.mediaType === "image"
      ? veronixMediaSrc({
          historyId: job.historyId,
          url: job.url,
          mediaType: "image",
        }) || job.url
      : null;

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const handleDownload = async () => {
    if (downloading || waiting || (!job.url && !job.historyId)) return;
    setDownloading(true);
    setNote("جاري التحضير…");
    try {
      const path = veronixDownloadPath({
        historyId: job.historyId,
        url: job.url,
        mediaType: job.mediaType,
      });
      if (!path) throw new Error("الملف غير جاهز");
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) throw new Error("تعذر التحميل");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `veronix-${job.assetId || job.clientId}.${job.mediaType === "image" ? "jpg" : "mp4"}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNote("بدأ التحميل");
    } catch {
      setNote("تعذر التحميل");
    } finally {
      setDownloading(false);
    }
  };

  const handleEdit = async () => {
    if (editing || waiting) return;
    setEditing(true);
    try {
      let characters: Array<{
        type: "image";
        id: string;
        url: string;
        label: string;
      }> = [];
      let editPrompt = job.prompt || prompt || "";

      if (job.assetId) {
        try {
          const { res, data } = await fetchJson<{
            assets?: Array<{
              id: string;
              prompt?: string;
              referenceImages?: Array<{
                id?: string;
                url: string;
                label?: string;
              }>;
            }>;
          }>("/api/assets");
          if (res.ok) {
            const asset = (data.assets || []).find((a) => a.id === job.assetId);
            if (asset?.prompt) editPrompt = asset.prompt;
            if (asset?.referenceImages?.length) {
              characters = asset.referenceImages
                .filter((r) => r?.url)
                .slice(0, 4)
                .map((r, i) => ({
                  type: "image" as const,
                  id: r.id || `edit-ref-${job.assetId}-${i}`,
                  url: r.url,
                  label: r.label || "",
                }));
            }
          }
        } catch {
          // keep local prompt
        }
      }

      writeEditDraft({
        prompt: editPrompt,
        media: job.mediaType,
        startFrame: null,
        referenceImages: characters,
        sourceAssetId: job.assetId,
      });
      router.push(
        job.mediaType === "image"
          ? "/create/image?edit=1"
          : "/create/video?edit=1",
      );
    } finally {
      setEditing(false);
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#141821]">
      <div className="flex items-center justify-between gap-1 border-b border-white/8 px-2 py-1.5">
        <p className="truncate text-[11px] font-semibold text-white/80">
          {waiting ? "جاري التوليد" : failed ? "فشل التوليد" : "جاهز"}
        </p>
        {waiting ? <GenerateClock startedAt={clockStart} size="compact" /> : null}
      </div>

      <div className="relative aspect-video bg-black/50">
        {src ? (
          <>
            <video
              ref={videoRef}
              key={src}
              src={src}
              playsInline
              controls={false}
              controlsList="nodownload"
              className="h-full w-full object-contain"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <div className="absolute inset-x-0 bottom-2 z-20 flex justify-center">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30 backdrop-blur-md transition hover:bg-black/70"
                aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
              >
                {playing ? (
                  <Pause className="h-4 w-4" fill="currentColor" />
                ) : (
                  <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" />
                )}
              </button>
            </div>
          </>
        ) : imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="preview"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            {waiting ? (
              <GenerateClock startedAt={clockStart} size="large" />
            ) : failed ? (
              <p className="text-[11px] font-semibold leading-snug text-rose-200">
                {job.error || "فشل التوليد"}
              </p>
            ) : (
              <p className="text-xs text-white/40">لا توجد معاينة بعد</p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/8 px-2 py-1 text-center text-[9px] text-white/45">
        VYRONIX
      </div>

      <div className="flex gap-1 p-1.5">
        <button
          type="button"
          onClick={() => onShare(job)}
          disabled={!job.url}
          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-lg border border-white/15 bg-white/5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
        >
          <Share2 className="h-3 w-3 text-[#22f0ff]" />
          Share
        </button>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={waiting || downloading || (!job.url && !job.historyId)}
          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-lg bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
        >
          {downloading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          تحميل
        </button>
        <button
          type="button"
          onClick={() => void handleEdit()}
          disabled={waiting || editing}
          className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-lg border border-white/15 bg-white/5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
          title="تعديل"
        >
          {editing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Pencil className="h-3 w-3" />
          )}
          تعديل
        </button>
      </div>
      {note ? (
        <p className="px-2 pb-1.5 text-center text-[10px] text-[#22f0ff]">{note}</p>
      ) : null}
    </div>
  );
}

export function StudioResultGrid({
  jobs,
  prompt,
  onShare,
}: {
  jobs: StudioJob[];
  prompt: string;
  onShare: (job: StudioJob) => void;
}) {
  if (!jobs.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white">معاينة النتيجة</p>
      {/* Always 3 side-by-side slots per row (as requested). */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {jobs.map((job) => (
          <ResultCard
            key={job.clientId}
            job={job}
            prompt={prompt}
            onShare={onShare}
          />
        ))}
      </div>
    </div>
  );
}
