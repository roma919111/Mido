"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Loader2,
  Pencil,
  Play,
  Share2,
  Trash2,
} from "lucide-react";
import { veronixMediaSrc, veronixPosterSrc } from "@/lib/media-proxy";
import type { StudioJob } from "@/lib/studio-jobs";
import { writeEditDraft } from "@/lib/edit-draft";
import { resolveVideoEditSource } from "@/lib/video-edit-source";
import { fetchJson } from "@/lib/fetch-json";
import { inferTargetSecondsFromAsset } from "@/lib/generate-eta";
import { useRouter } from "next/navigation";
import { GenerateClock } from "@/components/veronix/GenerateClock";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { stripInternalPromptNotes } from "@/lib/character-names";
import { prepareCharacterRefsForEdit } from "@/lib/hydrate-ref-images";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [makingVideo, setMakingVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const waiting = job.status === "running";
  const failed = job.status === "failed";
  const clockStart =
    typeof job.startedAt === "number" && job.startedAt > 0
      ? job.startedAt
      : Date.now();
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
  }, [mediaUrl]);

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
      setArmed(true);
      return;
    }
    if (el.paused) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const openInAssets = () => {
    if (waiting) return;
    const type = job.mediaType === "image" ? "image" : "video";
    const qs = new URLSearchParams({ type });
    if (job.assetId) qs.set("id", job.assetId);
    router.push(`/assets?${qs.toString()}`);
  };

  const canOpenAssets = !waiting && (Boolean(job.assetId) || job.status === "completed");

  const handleEdit = async () => {
    if (editing || waiting) return;
    setEditing(true);
    try {
      let editPrompt = stripInternalPromptNotes(job.prompt || "");

      if (job.mediaType === "video") {
        try {
          const { res, data } = await fetchJson<{
            assets?: Array<{
              id: string;
              mediaType?: string;
              status?: string;
              url?: string;
              prompt?: string;
              mode?: string;
              targetSeconds?: number;
              aspectRatio?: string;
              resolution?: string;
              preferClarity?: boolean;
              referenceImages?: Array<{
                id?: string;
                url: string;
                label?: string;
              }>;
              startFrame?: {
                id?: string;
                url: string;
                label?: string;
              } | null;
            }>;
          }>("/api/assets");
          if (res.ok) {
            const assets = data.assets || [];
            const asset = job.assetId
              ? assets.find((a) => a.id === job.assetId)
              : undefined;
            if (asset?.prompt) {
              editPrompt = stripInternalPromptNotes(asset.prompt);
            }
            const durationSec =
              (asset ? inferTargetSecondsFromAsset(asset) : undefined) ||
              job.targetSeconds ||
              undefined;

            const source = await resolveVideoEditSource({
              asset: asset || null,
              assets,
              prompt: editPrompt,
              jobStartFrameUrl: job.startFrameUrl,
              duration: durationSec,
            });

            writeEditDraft({
              prompt: source.prompt || editPrompt,
              media: "video",
              startFrame: source.startFrame,
              referenceImages: source.referenceImages,
              useAsStartFrame: source.useAsStartFrame,
              sourceAssetId: job.assetId,
              duration: source.duration,
              aspectRatio: source.aspectRatio,
              resolution: source.resolution,
              preferClarity: source.preferClarity,
            });
            const qs = new URLSearchParams({ edit: "1" });
            if (typeof source.duration === "number") {
              qs.set("duration", String(source.duration));
            }
            if (source.resolution) qs.set("resolution", source.resolution);
            if (source.aspectRatio) qs.set("aspect", source.aspectRatio);
            if (source.preferClarity) qs.set("clarity", "1");
            router.push(`/create/video?${qs.toString()}`);
            return;
          }
        } catch {
          // fall through to local draft
        }

        // No assets response — still try job-local start frame.
        if (job.startFrameUrl) {
          writeEditDraft({
            prompt: editPrompt,
            media: "video",
            startFrame: {
              type: "image",
              id: `start-job-${job.clientId}`,
              url: job.startFrameUrl,
              label: "start-frame",
            },
            referenceImages: [],
            useAsStartFrame: true,
            sourceAssetId: job.assetId,
            duration: job.targetSeconds,
          });
          const qs = new URLSearchParams({ edit: "1" });
          if (typeof job.targetSeconds === "number") {
            qs.set("duration", String(job.targetSeconds));
          }
          router.push(`/create/video?${qs.toString()}`);
          return;
        }
      }

      // Image Edit (or video fallback): restore character stills when present.
      let characters: Array<{
        type: "image";
        id: string;
        url: string;
        label: string;
      }> = [];
      let durationSec = job.targetSeconds;
      let aspectRatio: string | undefined;
      let resolution: string | undefined;
      let preferClarity: boolean | undefined;

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
            if (asset?.prompt) {
              editPrompt = stripInternalPromptNotes(asset.prompt);
            }
            durationSec =
              (asset ? inferTargetSecondsFromAsset(asset) : undefined) ||
              job.targetSeconds;
            aspectRatio = asset?.aspectRatio;
            resolution = asset?.resolution;
            preferClarity = asset?.preferClarity;
            if (asset?.referenceImages?.length) {
              characters = await prepareCharacterRefsForEdit(
                asset.referenceImages.map((r, i) => ({
                  type: "image" as const,
                  id: r.id || `edit-ref-${job.assetId}-${i}`,
                  url: r.url,
                  label: r.label || "",
                })),
              );
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
        duration: durationSec,
        aspectRatio,
        resolution,
        preferClarity,
      });
      const qs = new URLSearchParams({ edit: "1" });
      if (typeof durationSec === "number") qs.set("duration", String(durationSec));
      if (resolution) qs.set("resolution", resolution);
      if (aspectRatio) qs.set("aspect", aspectRatio);
      if (preferClarity) qs.set("clarity", "1");
      router.push(
        job.mediaType === "image"
          ? `/create/image?${qs.toString()}`
          : `/create/video?${qs.toString()}`,
      );
    } finally {
      setEditing(false);
    }
  };

  const handleMakeVideo = async () => {
    if (makingVideo || waiting || job.mediaType !== "image" || !job.url) return;
    setMakingVideo(true);
    try {
      writeEditDraft({
        prompt: job.prompt || "",
        media: "video",
        startFrame: {
          type: "image",
          id: `start-from-job-${job.clientId}`,
          url: job.url,
          label: "start-frame",
        },
        referenceImages: [],
        useAsStartFrame: true,
        sourceAssetId: job.assetId,
        resolution: "720p",
      });
      router.push("/create/video?edit=1");
    } finally {
      setMakingVideo(false);
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
        {waiting ? <GenerateClock startedAt={clockStart} size="compact" /> : null}
      </div>

      <div
        className={`relative aspect-video bg-black/50 ${
          canOpenAssets ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          if (canOpenAssets) openInAssets();
        }}
        role={canOpenAssets ? "link" : undefined}
        tabIndex={canOpenAssets ? 0 : undefined}
        onKeyDown={(e) => {
          if (!canOpenAssets) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openInAssets();
          }
        }}
        aria-label={canOpenAssets ? t.nav.assets : undefined}
      >
        {mediaUrl ? (
          <>
            {!armed && posterSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterSrc}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <video
              ref={videoRef}
              key={mediaUrl}
              src={src || undefined}
              poster={posterSrc || undefined}
              playsInline
              preload={armed ? "auto" : "none"}
              controls={false}
              controlsList="nodownload"
              className="pointer-events-none h-full w-full object-cover"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {!playing ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="absolute bottom-2 start-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow"
                aria-label={t.assets.play}
              >
                <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="absolute bottom-2 start-2 z-20 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white"
              >
                {t.assets.pause}
              </button>
            )}
          </>
        ) : imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="preview"
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            {waiting ? (
              <div className="flex flex-col items-center gap-1.5">
                <GenerateClock startedAt={clockStart} size="large" />
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
        {job.mediaType === "image" ? (
          <span className="pointer-events-none absolute end-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#b9a6ff]">
            {t.create.resultImages}
          </span>
        ) : job.url || waiting ? (
          <span className="pointer-events-none absolute end-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#22f0ff]">
            {t.create.resultVideos}
          </span>
        ) : null}
      </div>

      <div className="border-t border-white/8 px-2 py-1 text-center text-[9px] text-white/45">
        VYRONIX
      </div>

      <div
        className={`grid gap-1.5 p-2 ${
          job.mediaType === "image" ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
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
          {t.assets.edit}
        </button>
        {job.mediaType === "image" ? (
          <button
            type="button"
            onClick={() => void handleMakeVideo()}
            disabled={waiting || makingVideo || !job.url || failed}
            className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-1 py-1.5 text-[11px] font-bold text-[#22f0ff] disabled:opacity-40"
          >
            {makingVideo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clapperboard className="h-4 w-4" />
            )}
            {t.assets.makeVideo}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onShare(job)}
          disabled={!job.url}
          className="inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/20 bg-white/10 px-1 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
        >
          <Share2 className="h-4 w-4 text-[#22f0ff]" />
          {t.create.resultShare}
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
}: {
  jobs: StudioJob[];
  onShare: (job: StudioJob) => void;
  onDelete: (job: StudioJob) => void;
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

  const visibleJobs = useMemo(() => {
    const list =
      tab === "all" ? jobs : tab === "video" ? videos : images;
    return [...list].sort((a, b) => {
      const ta =
        typeof a.startedAt === "number" && a.startedAt > 0 ? a.startedAt : 0;
      const tb =
        typeof b.startedAt === "number" && b.startedAt > 0 ? b.startedAt : 0;
      if (tb !== ta) return tb - ta;
      return 0;
    });
  }, [tab, jobs, videos, images]);

  if (!jobs.length) return null;

  return (
    <div className="space-y-3" dir={dir}>
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
              {item.id === "all" && jobs.length ? ` · ${jobs.length}` : null}
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

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4">
        {visibleJobs.map((job) => (
          <ResultCard
            key={job.clientId}
            job={job}
            onShare={onShare}
            onDelete={onDelete}
          />
        ))}
      </div>

      {tab === "video" && !videos.length ? (
        <p className="text-xs text-white/45">{t.create.resultEmpty}</p>
      ) : null}
      {tab === "image" && !images.length ? (
        <p className="text-xs text-white/45">{t.create.resultEmpty}</p>
      ) : null}
    </div>
  );
});
