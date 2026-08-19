"use client";

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  Loader2,
  Pencil,
  Play,
  Scissors,
  Share2,
  Trash2,
} from "lucide-react";
import { veronixMediaSrc, veronixPosterSrc } from "@/lib/media-proxy";
import type { StudioJob } from "@/lib/studio-jobs";
import { writeEditDraft } from "@/lib/edit-draft";
import { sendVideoToEditStudio } from "@/lib/send-to-edit-studio";
import { fetchJson } from "@/lib/fetch-json";
import { inferTargetSecondsFromAsset } from "@/lib/generate-eta";
import { useRouter } from "next/navigation";
import { GenerateClock } from "@/components/veronix/GenerateClock";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { canUseEditStudio } from "@/lib/plans";

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
  const { t } = useLocale();
  const { user } = useCustomerUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [editing, setEditing] = useState(false);
  const [sendingStudio, setSendingStudio] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const clockAnchorRef = useRef<number | null>(null);
  const generating = job.status === "running";
  const waiting = generating && !job.url;
  const failed = job.status === "failed";
  if (
    typeof job.startedAt === "number" &&
    job.startedAt > 0 &&
    clockAnchorRef.current !== job.startedAt
  ) {
    clockAnchorRef.current = job.startedAt;
  }
  if (clockAnchorRef.current == null) {
    clockAnchorRef.current = Date.now();
  }
  const clockStart = clockAnchorRef.current;
  const showLiveClock = generating;
  const mediaUrl =
    job.url && job.mediaType === "video"
      ? veronixMediaSrc({
          historyId: job.historyId,
          url: job.url,
          mediaType: "video",
        })
      : null;
  const src = armed ? mediaUrl : null;
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
    setArmed(false);
    setPosterFailed(false);
    clockAnchorRef.current =
      typeof job.startedAt === "number" && job.startedAt > 0
        ? job.startedAt
        : null;
    const el = videoRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        // ignore
      }
    }
  }, [job.clientId, job.startedAt, mediaUrl]);

  useEffect(() => {
    if (!armed || !mediaUrl) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => undefined);
  }, [armed, mediaUrl, src]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el || !mediaUrl) return;
    if (!armed) {
      flushSync(() => {
        setArmed(true);
      });
      void el
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          const onReady = () => {
            el.removeEventListener("canplay", onReady);
            void el
              .play()
              .then(() => setPlaying(true))
              .catch(() => setPlaying(false));
          };
          el.addEventListener("canplay", onReady, { once: true });
        });
      return;
    }
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
              targetSeconds?: number;
              aspectRatio?: string;
              resolution?: string;
              preferClarity?: boolean;
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
            const durationSec =
              (asset ? inferTargetSecondsFromAsset(asset) : undefined) ||
              job.targetSeconds ||
              undefined;
            writeEditDraft({
              prompt: editPrompt,
              media: job.mediaType,
              startFrame: null,
              referenceImages: characters,
              sourceAssetId: job.assetId,
              duration: durationSec,
              aspectRatio: asset?.aspectRatio,
              resolution: asset?.resolution,
              preferClarity: asset?.preferClarity,
            });
            const qs = new URLSearchParams({ edit: "1" });
            if (typeof durationSec === "number") {
              qs.set("duration", String(durationSec));
            }
            if (asset?.resolution) qs.set("resolution", asset.resolution);
            if (asset?.aspectRatio) qs.set("aspect", asset.aspectRatio);
            if (asset?.preferClarity) qs.set("clarity", "1");
            router.push(
              job.mediaType === "image"
                ? `/create/image?${qs.toString()}`
                : `/create/video?${qs.toString()}`,
            );
            return;
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
        duration: job.targetSeconds,
        aspectRatio: undefined,
        resolution: undefined,
        preferClarity: undefined,
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

  const handleSendToStudio = () => {
    if (sendingStudio || waiting || !mediaUrl || job.mediaType !== "video") return;
    if (!canUseEditStudio(user?.planId)) {
      router.push("/pricing?feature=edit");
      return;
    }
    setSendingStudio(true);
    try {
      sendVideoToEditStudio(router, {
        videoUrl: mediaUrl,
        posterUrl: posterSrc || undefined,
        assetId: job.assetId,
        historyId: job.historyId,
        prompt: job.prompt,
        durationSec: job.targetSeconds,
      });
    } finally {
      setSendingStudio(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || waiting) return;
    setDeleting(true);
    try {
      if (job.assetId) {
        await fetchJson("/api/assets", {
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
          {waiting
            ? t.assets.generating
            : failed
              ? t.assets.failed
              : t.create.resultReady}
        </p>
        {showLiveClock ? <GenerateClock startedAt={clockStart} size="compact" /> : null}
      </div>

      <div className="relative aspect-video bg-black/50">
        {mediaUrl ? (
          <>
            {!armed && posterSrc && !posterFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setPosterFailed(true)}
              />
            ) : null}
            <video
              ref={videoRef}
              key={mediaUrl}
              src={src || (posterFailed && !armed ? mediaUrl : undefined)}
              poster={!posterFailed && posterSrc ? posterSrc : undefined}
              playsInline
              preload={
                waiting
                  ? "none"
                  : armed
                    ? "auto"
                    : posterFailed
                      ? "metadata"
                      : "none"
              }
              controls={false}
              controlsList="nodownload"
              className={`h-full w-full object-cover${
                !armed && posterSrc && !posterFailed ? " opacity-0" : ""
              }`}
              onClick={togglePlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {!playing && !generating ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="absolute inset-0 z-20 flex items-center justify-center"
                aria-label={t.assets.play}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black shadow">
                  <Play className="h-5 w-5 translate-x-[1px]" fill="currentColor" />
                </span>
              </button>
            ) : null}
            {generating ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 bg-black/55">
                <GenerateClock startedAt={clockStart} size="large" />
                <p className="text-xs font-semibold text-white/85">
                  {t.assets.generating}
                </p>
              </div>
            ) : null}
          </>
        ) : imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            {generating ? (
              <div className="flex flex-col items-center gap-1.5">
                <GenerateClock startedAt={clockStart} size="large" />
                <p className="text-xs font-semibold text-white/80">
                  {t.assets.generating}
                </p>
              </div>
            ) : waiting ? (
              <div className="flex flex-col items-center gap-1.5">
                <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
                <p className="text-xs font-semibold text-white/80">
                  {t.assets.generating}
                </p>
              </div>
            ) : failed ? (
              <p className="text-[11px] font-semibold leading-snug text-rose-200">
                {job.error || t.assets.failed}
              </p>
            ) : (
              <p className="text-xs text-white/40">{t.create.resultEmpty}</p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/8 px-2 py-1 text-center text-[9px] text-white/45">
        VYRONIX
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => void handleEdit()}
          disabled={waiting || editing}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/20 bg-white/10 px-1 py-1.5 text-[10px] font-bold text-white disabled:opacity-40 sm:text-[11px]"
        >
          {editing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pencil className="h-4 w-4 text-[#22f0ff]" />
          )}
          {t.assets.edit}
        </button>
        {job.mediaType === "video" ? (
          <button
            type="button"
            onClick={handleSendToStudio}
            disabled={waiting || sendingStudio || !job.url}
            className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-1 py-1.5 text-[10px] font-bold text-white disabled:opacity-40 sm:text-[11px]"
          >
            {sendingStudio ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="h-4 w-4 text-[#b9a6ff]" />
            )}
            {t.assets.sendToStudio}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onShare(job)}
          disabled={!job.url}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/20 bg-white/10 px-1 py-1.5 text-[10px] font-bold text-white disabled:opacity-40 sm:text-[11px]"
        >
          <Share2 className="h-4 w-4 text-[#22f0ff]" />
          {t.create.resultShare}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={waiting || deleting}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-rose-400/30 bg-rose-500/15 px-1 py-1.5 text-[10px] font-bold text-rose-100 disabled:opacity-40 sm:text-[11px]"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t.assets.delete}
        </button>
      </div>
    </div>
  );
}, (prev, next) =>
  jobVisualEqual(prev.job, next.job) &&
  prev.onShare === next.onShare &&
  prev.onDelete === next.onDelete,
);

type PreviewTab = "all" | "video" | "image";

export const StudioResultGrid = memo(function StudioResultGrid({
  jobs,
  onShare,
  onDelete,
  sectionRef,
}: {
  jobs: StudioJob[];
  onShare: (job: StudioJob) => void;
  onDelete: (job: StudioJob) => void;
  sectionRef?: RefObject<HTMLDivElement | null>;
}) {
  const { t, dir } = useLocale();
  const [tab, setTab] = useState<PreviewTab>("all");
  const seeded = useRef(false);

  const videos = useMemo(
    () => jobs.filter((j) => j.mediaType === "video"),
    [jobs],
  );
  const images = useMemo(
    () => jobs.filter((j) => j.mediaType === "image"),
    [jobs],
  );

  useEffect(() => {
    if (seeded.current || !jobs.length) return;
    seeded.current = true;
    if (videos.length && !images.length) setTab("video");
    else if (images.length && !videos.length) setTab("image");
    else setTab("all");
  }, [jobs.length, videos.length, images.length]);

  useEffect(() => {
    if (!jobs.length) return;
    const runningVideo = videos.some((v) => v.status === "running");
    if (!runningVideo) return;
    if (tab === "image" && videos.length > 0) {
      setTab(images.length > 0 ? "all" : "video");
    }
  }, [jobs, videos, images, tab]);

  useEffect(() => {
    if (!jobs.length) return;
    const completedVideo = videos.some(
      (v) => v.status === "completed" && Boolean(v.url),
    );
    if (!completedVideo) return;
    if (tab === "image" && videos.length > 0) {
      setTab(images.length > 0 ? "all" : "video");
    }
  }, [jobs, videos, images, tab]);

  const runningJobs = useMemo(
    () => jobs.filter((j) => j.status === "running"),
    [jobs],
  );
  const gridClockStart = useMemo(() => {
    const stamps = runningJobs
      .map((j) => j.startedAt)
      .filter((t): t is number => typeof t === "number" && t > 0);
    return stamps.length ? Math.min(...stamps) : Date.now();
  }, [runningJobs]);

  if (!jobs.length) return null;

  const showVideos = tab === "all" || tab === "video";
  const showImages = tab === "all" || tab === "image";
  const sideBySide = tab === "all" && videos.length > 0 && images.length > 0;

  return (
    <div ref={sectionRef} className="space-y-3" dir={dir}>
      {runningJobs.length > 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#22f0ff]/30 bg-[#22f0ff]/8 px-4 py-4">
          <GenerateClock startedAt={gridClockStart} size="large" />
          <p className="text-center text-sm font-semibold text-white/85">
            {runningJobs.length > 1
              ? `جاري توليد ${runningJobs.length} ${runningJobs[0]?.mediaType === "image" ? "صور" : "فيديوهات"}…`
              : runningJobs[0]?.mediaType === "image"
                ? "جاري توليد الصورة…"
                : "جاري توليد الفيديو…"}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{t.create.resultPreview}</p>
        <div className="flex rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
          {(
            [
              { id: "all" as const, label: t.create.resultAll },
              { id: "video" as const, label: t.create.resultVideos },
              { id: "image" as const, label: t.create.resultImages },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition sm:px-3 sm:text-[11px] ${
                tab === item.id
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {item.label}
              {item.id === "video" && videos.length
                ? ` · ${videos.length}`
                : null}
              {item.id === "image" && images.length
                ? ` · ${images.length}`
                : null}
            </button>
          ))}
        </div>
      </div>

      {sideBySide ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#22f0ff]/90">
              {t.create.resultVideos}
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1 lg:grid-cols-2">
              {videos.map((job) => (
                <ResultCard
                  key={job.clientId}
                  job={job}
                  onShare={onShare}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
          <section className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b9a6ff]">
              {t.create.resultImages}
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1 lg:grid-cols-2">
              {images.map((job) => (
                <ResultCard
                  key={job.clientId}
                  job={job}
                  onShare={onShare}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4">
          {(showVideos ? videos : [])
            .concat(showImages ? images : [])
            .map((job) => (
              <ResultCard
                key={job.clientId}
                job={job}
                onShare={onShare}
                onDelete={onDelete}
              />
            ))}
        </div>
      )}

      {tab === "video" && !videos.length ? (
        <p className="text-xs text-white/45">{t.create.resultEmpty}</p>
      ) : null}
      {tab === "image" && !images.length ? (
        <p className="text-xs text-white/45">{t.create.resultEmpty}</p>
      ) : null}
    </div>
  );
});
