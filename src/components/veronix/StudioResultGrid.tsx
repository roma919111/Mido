"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Pause,
  Pencil,
  Play,
  Share2,
  Trash2,
} from "lucide-react";
import { veronixMediaSrc, veronixPosterSrc } from "@/lib/media-proxy";
import type { StudioJob } from "@/lib/studio-jobs";
import { writeEditDraft } from "@/lib/edit-draft";
import { fetchJson } from "@/lib/fetch-json";
import { useRouter } from "next/navigation";
import { GenerateClock } from "@/components/veronix/GenerateClock";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function jobVisualEqual(a: StudioJob, b: StudioJob): boolean {
  return (
    a.clientId === b.clientId &&
    a.status === b.status &&
    a.url === b.url &&
    a.mediaType === b.mediaType &&
    a.historyId === b.historyId &&
    a.assetId === b.assetId &&
    a.error === b.error &&
    a.startedAt === b.startedAt &&
    a.prompt === b.prompt
  );
}

const ResultCard = memo(function ResultCard({
  job,
  onShare,
  onDelete,
}: {
  job: StudioJob;
  onShare: (job: StudioJob) => void;
  onDelete: (job: StudioJob) => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
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
  const posterSrc =
    job.url && job.mediaType === "video"
      ? veronixPosterSrc({
          historyId: job.historyId,
          url: job.url,
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

  useEffect(() => {
    setPlaying(false);
    setDurationSec(0);
    const el = videoRef.current;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, [src]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el || !src) return;
    if (el.paused) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
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
      let editPrompt = job.prompt || "";

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

  const handleDelete = async () => {
    if (deleting || waiting) return;
    setDeleting(true);
    try {
      if (job.assetId) {
        await fetchJson(`/api/assets`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: job.assetId }),
        });
      }
      onDelete(job);
    } catch {
      onDelete(job);
    } finally {
      setDeleting(false);
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
              poster={posterSrc || undefined}
              playsInline
              preload="metadata"
              controls={false}
              controlsList="nodownload"
              className="h-full w-full object-contain"
              onClick={togglePlay}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDurationSec(d);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {/* Native media-player controls at the bottom */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2.5 pb-2 pt-8">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow"
                aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
              >
                {playing ? (
                  <Pause className="h-4 w-4" fill="currentColor" />
                ) : (
                  <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
                )}
              </button>
              <span className="rounded bg-black/55 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white">
                {formatDuration(durationSec || job.targetSeconds || 0)}
              </span>
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
              <div className="flex flex-col items-center gap-1.5">
                <GenerateClock startedAt={clockStart} size="large" />
                <p className="text-xs font-semibold text-white/80">جاري التوليد</p>
              </div>
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

      <div className="grid grid-cols-3 gap-1.5 p-2">
        <button
          type="button"
          onClick={() => void handleEdit()}
          disabled={waiting || editing}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/20 bg-white/10 px-1 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {editing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pencil className="h-4 w-4 text-[#22f0ff]" />
          )}
          تعديل
        </button>
        <button
          type="button"
          onClick={() => onShare(job)}
          disabled={!job.url}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/20 bg-white/10 px-1 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
        >
          <Share2 className="h-4 w-4 text-[#22f0ff]" />
          شير
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={waiting || deleting}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-rose-400/30 bg-rose-500/15 px-1 py-1.5 text-[11px] font-bold text-rose-100 disabled:opacity-40"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          حذف
        </button>
      </div>
    </div>
  );
}, (prev, next) =>
  jobVisualEqual(prev.job, next.job) &&
  prev.onShare === next.onShare &&
  prev.onDelete === next.onDelete,
);

export const StudioResultGrid = memo(function StudioResultGrid({
  jobs,
  onShare,
  onDelete,
}: {
  jobs: StudioJob[];
  onShare: (job: StudioJob) => void;
  onDelete: (job: StudioJob) => void;
}) {
  if (!jobs.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white">معاينة النتيجة</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {jobs.map((job) => (
          <ResultCard
            key={job.clientId}
            job={job}
            onShare={onShare}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
});
