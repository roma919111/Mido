"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Clapperboard,
  LayoutGrid,
  Loader2,
  Pause,
  Pencil,
  Play,
  Rows3,
  Trash2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerSession } from "@/components/veronix/useCustomerSession";
import { writeCachedCustomer } from "@/lib/customer-session-cache";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearEtaStart,
  inferTargetSecondsFromAsset,
  lockEtaStart,
} from "@/lib/generate-eta";
import { writeEditDraft } from "@/lib/edit-draft";
import {
  hydrateRefImageUrl,
  prepareCharacterRefsForEdit,
} from "@/lib/hydrate-ref-images";
import { resolveVideoEditSource } from "@/lib/video-edit-source";
import {
  cleanAssetPrompt,
  assetPromptTitle,
  veronixDownloadPath,
  veronixMediaSrc,
  veronixPosterSrc,
} from "@/lib/media-proxy";
import {
  clearAssetsCache,
  readAssetsCache,
  writeAssetsCache,
  warmAssetPosters,
  type CachedAssetItem,
} from "@/lib/assets-cache";
import { displayBytePlusAssetError } from "@/lib/byteplus-errors";
import type { VisualReference } from "@/lib/types";
import { GenerateClock } from "@/components/veronix/GenerateClock";

type AssetItem = CachedAssetItem & {
  jobMeta?: { generateAudio?: boolean };
};

type VideoViewMode = "browse" | "grid";

const VIEW_MODE_KEY = "vyronix-assets-video-view";
const GRID_ZOOM_KEY = "vyronix-assets-grid-zoom";
const GRID_ZOOM_MIN = 1;
const GRID_ZOOM_MAX = 4;

function readStoredViewMode(): VideoViewMode {
  if (typeof window === "undefined") return "browse";
  try {
    const v = sessionStorage.getItem(VIEW_MODE_KEY);
    return v === "grid" ? "grid" : "browse";
  } catch {
    return "browse";
  }
}

function readStoredGridZoom(): number {
  if (typeof window === "undefined") return 2;
  try {
    const n = Number(sessionStorage.getItem(GRID_ZOOM_KEY));
    if (Number.isFinite(n)) {
      return Math.min(GRID_ZOOM_MAX, Math.max(GRID_ZOOM_MIN, Math.round(n)));
    }
  } catch {
    // ignore
  }
  return 2;
}

/** Build generation notes: clarity, duration, aspect, audio. */
function videoMetaChips(
  item: AssetItem,
  labels: { withAudio: string; noAudio: string; clarityMark: string },
): string[] {
  const chips: string[] = [];
  const res = item.resolution?.trim();
  if (res) {
    chips.push(item.preferClarity ? `${res} · ${labels.clarityMark}` : res);
  } else if (item.preferClarity) {
    chips.push(labels.clarityMark);
  }

  if (typeof item.targetSeconds === "number" && item.targetSeconds > 0) {
    chips.push(`${Math.round(item.targetSeconds)}s`);
  } else {
    const fromPrompt = /دمج\s+(\d+)\s+لقطات/u.exec(item.prompt || "");
    if (fromPrompt) {
      const shots = Number(fromPrompt[1]);
      if (Number.isFinite(shots) && shots > 0) chips.push(`${shots * 4}s`);
    } else {
      const secMatch = /(\d+)\s*ث/u.exec(item.prompt || "");
      const sec = secMatch ? Number(secMatch[1]) : NaN;
      if (Number.isFinite(sec) && sec >= 4) chips.push(`${sec}s`);
    }
  }

  const ar = item.aspectRatio?.trim();
  if (ar) chips.push(ar);

  const audio =
    typeof item.generateAudio === "boolean"
      ? item.generateAudio
      : typeof item.jobMeta?.generateAudio === "boolean"
        ? item.jobMeta.generateAudio
        : undefined;
  if (typeof audio === "boolean") {
    chips.push(audio ? labels.withAudio : labels.noAudio);
  }
  return chips;
}

function VideoMetaNotes({
  item,
  className = "",
  compact = false,
}: {
  item: AssetItem;
  className?: string;
  /** Single condensed line for tight grid cells. */
  compact?: boolean;
}) {
  const { t, dir } = useLocale();
  const chips = videoMetaChips(item, {
    withAudio: t.assets.withAudio,
    noAudio: t.assets.noAudio,
    clarityMark: t.assets.clarityMark,
  });
  if (!chips.length) return null;
  if (compact) {
    return (
      <p
        className={`truncate text-[9px] font-medium tracking-wide text-white/75 ${className}`}
        dir={dir}
      >
        {chips.join(" · ")}
      </p>
    );
  }
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      dir={dir}
    >
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-md bg-white/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/90 ring-1 ring-white/15"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

/** Collapsed 2-line prompt + tappable Show more opens a scrollable dropdown sheet. */
function AssetPromptPanel({
  prompt,
  expanded,
  long,
  onToggle,
  showMoreLabel,
  showLessLabel,
  footer,
}: {
  prompt: string;
  expanded: boolean;
  long: boolean;
  onToggle: () => void;
  showMoreLabel: string;
  showLessLabel: string;
  footer?: ReactNode;
}) {
  return (
    <div className="mt-1.5">
      {expanded ? (
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="max-h-[min(42vh,22rem)] overflow-y-auto overscroll-contain px-3 py-2.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90 sm:text-[15px]">
              {prompt}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20"
            >
              {showLessLabel}
            </button>
            {footer}
          </div>
        </div>
      ) : (
        <>
          <p className="line-clamp-2 text-sm leading-relaxed text-white/80 sm:text-[15px]">
            {prompt}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {long ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20"
              >
                {showMoreLabel}
              </button>
            ) : null}
            {footer}
          </div>
        </>
      )}
    </div>
  );
}

function RunningCountdown({
  assetId,
  createdAt,
}: {
  assetId: string;
  createdAt: string;
  targetSeconds: number;
}) {
  const started = lockEtaStart(assetId, createdAt);
  return <GenerateClock startedAt={started} size="card" />;
}

async function captureVideoFrame(
  video: HTMLVideoElement,
): Promise<VisualReference | null> {
  try {
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.88);
    return {
      type: "image",
      id: `edit-frame-${Date.now()}`,
      url,
      label: "edit-start-frame",
    };
  } catch {
    return null;
  }
}

function FeedVideoSlide({
  item,
  active,
  loadMedia,
  muted,
  onToggleMute,
  onDeleted,
}: {
  item: AssetItem;
  active: boolean;
  /** Load poster/proxy only for active + neighbors — keeps Assets snappy. */
  loadMedia: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const { t, dir } = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  /** Drop HTML poster once frames paint so a washed first-frame/poster cannot linger. */
  const [hidePoster, setHidePoster] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** Only attach video src after Play — neighbors stay on poster (CDN bytes). */
  const [armed, setArmed] = useState(false);

  const mediaUrl = useMemo(
    () =>
      veronixMediaSrc({
        historyId: item.historyId,
        url: item.url,
        mediaType: "video",
      }),
    [item.historyId, item.url],
  );
  const src = loadMedia && armed ? mediaUrl : null;
  // Prefer URL-based posters (CDN) — skip BytePlus history lookup on cold open.
  const poster = useMemo(
    () =>
      loadMedia
        ? veronixPosterSrc({
            url: item.url,
            historyId: item.historyId,
          })
        : null,
    [loadMedia, item.url, item.historyId],
  );
  const prompt = cleanAssetPrompt(item.prompt);
  const title = assetPromptTitle(item.prompt);
  const promptLong = prompt.length > 110;
  const canPlay =
    Boolean(mediaUrl) &&
    item.status !== "failed" &&
    item.status !== "running";

  useEffect(() => {
    setPromptExpanded(false);
    setPosterFailed(false);
    setHidePoster(false);
    setPlaying(false);
    setArmed(false);
  }, [item.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !canPlay) return;
    // Pause + unload only when leaving the slide — never on mute toggles.
    if (!active) {
      el.pause();
      setPlaying(false);
      setArmed(false);
      setHidePoster(false);
      try {
        el.removeAttribute("src");
        el.load();
      } catch {
        // ignore
      }
    }
  }, [active, canPlay]);

  /**
   * Button-only play.
   * Important: set `armed` with flushSync so React attaches `src` once,
   * then call play() in the same click. Do NOT also set el.src manually —
   * that double-assignment reloads the media mid-buffer (2s → restart → 4s…).
   */
  const handlePlayClick = () => {
    const el = videoRef.current;
    if (!el || !canPlay || !mediaUrl) return;

    if (!armed) {
      flushSync(() => {
        setArmed(true);
      });
    }

    // Same source already attached — just resume.
    void el
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        // Rare: src not ready yet after flushSync — wait one canplay, once.
        const onReady = () => {
          el.removeEventListener("canplay", onReady);
          void el
            .play()
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false));
        };
        el.addEventListener("canplay", onReady, { once: true });
      });
  };

  const handlePauseClick = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
  };

  const handleEdit = async () => {
    if (editing) return;
    setEditing(true);
    try {
      const editDuration = inferTargetSecondsFromAsset(item);
      const liveVideoSec =
        videoRef.current &&
        Number.isFinite(videoRef.current.duration) &&
        videoRef.current.duration >= 4
          ? Math.min(15, Math.max(4, Math.round(videoRef.current.duration)))
          : null;
      const durationSec = item.targetSeconds || liveVideoSec || editDuration;

      let assetsList: Array<{
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
        referenceImages?: typeof item.referenceImages;
        startFrame?: typeof item.startFrame;
      }> = [];
      try {
        const { res, data } = await fetchJson<{
          assets?: typeof assetsList;
        }>("/api/assets");
        if (res.ok) assetsList = data.assets || [];
      } catch {
        // keep local item
      }

      const asset =
        assetsList.find((a) => a.id === item.id) ||
        ({
          id: item.id,
          mediaType: item.mediaType,
          status: item.status,
          url: item.url,
          prompt: item.prompt,
          mode: item.mode,
          targetSeconds: item.targetSeconds,
          aspectRatio: item.aspectRatio,
          resolution: item.resolution,
          preferClarity: item.preferClarity,
          referenceImages: item.referenceImages,
          startFrame: item.startFrame,
        } as (typeof assetsList)[number]);

      const source = await resolveVideoEditSource({
        asset,
        assets: assetsList.length ? assetsList : [asset],
        prompt: prompt || item.prompt || "",
        duration: durationSec,
      });

      if (source.startFrame?.url && source.useAsStartFrame) {
        const hydrated =
          (await hydrateRefImageUrl(source.startFrame.url)) ||
          source.startFrame.url;
        writeEditDraft({
          prompt: source.prompt || prompt || item.prompt || "",
          media: "video",
          startFrame: {
            type: "image",
            id: source.startFrame.id || `start-${item.id}`,
            url: hydrated,
            label: "start-frame",
          },
          referenceImages: [],
          useAsStartFrame: true,
          sourceAssetId: item.id,
          duration: source.duration || durationSec,
          resolution: source.resolution || item.resolution,
          aspectRatio: source.aspectRatio || item.aspectRatio,
          preferClarity: source.preferClarity ?? item.preferClarity,
        });
        const qs = new URLSearchParams({ edit: "1" });
        qs.set("duration", String(source.duration || durationSec));
        if (source.resolution || item.resolution) {
          qs.set("resolution", source.resolution || item.resolution || "");
        }
        if (source.aspectRatio || item.aspectRatio) {
          qs.set("aspect", source.aspectRatio || item.aspectRatio || "");
        }
        if (source.preferClarity ?? item.preferClarity) qs.set("clarity", "1");
        router.push(`/create/video?${qs.toString()}`);
        return;
      }

      let characters = source.referenceImages;

      // Only older assets without saved refs/start: capture a still as a character slot.
      if (!characters.length) {
        const el = videoRef.current;
        let frameUrl: string | null = null;
        if (el && active) {
          try {
            if (el.readyState < 2) {
              await new Promise<void>((resolve) => {
                const done = () => resolve();
                el.addEventListener("loadeddata", done, { once: true });
                window.setTimeout(done, 2500);
              });
            }
            try {
              el.currentTime = Math.min(0.15, (el.duration || 1) * 0.02);
              await new Promise<void>((resolve) => {
                const done = () => resolve();
                el.addEventListener("seeked", done, { once: true });
                window.setTimeout(done, 800);
              });
            } catch {
              // keep current frame
            }
            const captured = await captureVideoFrame(el);
            frameUrl = captured?.url || null;
          } catch {
            frameUrl = null;
          }
        }
        if (!frameUrl && poster && !posterFailed) {
          frameUrl = poster;
        }
        if (frameUrl) {
          const hydrated = await hydrateRefImageUrl(frameUrl);
          if (hydrated) {
            characters = [
              {
                type: "image",
                id: `edit-char-${item.id}`,
                url: hydrated,
                label: "من المشهد",
              },
            ];
          }
        }
      }

      writeEditDraft({
        prompt: source.prompt || prompt || item.prompt || "",
        media: "video",
        startFrame: null,
        referenceImages: characters,
        sourceAssetId: item.id,
        duration: source.duration || durationSec,
        resolution: source.resolution || item.resolution,
        aspectRatio: source.aspectRatio || item.aspectRatio,
        preferClarity: source.preferClarity ?? item.preferClarity,
      });
      const qs = new URLSearchParams({ edit: "1" });
      qs.set("duration", String(source.duration || durationSec));
      if (source.resolution || item.resolution) {
        qs.set("resolution", source.resolution || item.resolution || "");
      }
      if (source.aspectRatio || item.aspectRatio) {
        qs.set("aspect", source.aspectRatio || item.aspectRatio || "");
      }
      if (source.preferClarity ?? item.preferClarity) qs.set("clarity", "1");
      router.push(`/create/video?${qs.toString()}`);
    } finally {
      setEditing(false);
    }
  };

  const handleDownload = async () => {
    if (downloading || item.status !== "completed") return;
    const path = veronixDownloadPath({
      historyId: item.historyId,
      url: item.url,
      mediaType: "video",
    });
    if (!path) return;
    setDownloading(true);
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      if (!blob.size) throw new Error("empty");
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `veronix-${Date.now()}.mp4`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
    } catch {
      window.location.assign(path);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    const ok = window.confirm(
      dir === "rtl" ? "حذف هذا الفيديو من Assets؟" : "Delete this video from Assets?",
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const { res, data } = await fetchJson<{ error?: string }>("/api/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!res.ok) throw new Error(data.error || "delete failed");
      onDeleted(item.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section
      data-asset-id={item.id}
      className="relative h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] w-full snap-start snap-always overflow-hidden bg-black"
    >
      {canPlay ? (
        <>
          {/* Poster always for active+neighbors; video bytes only after Play. */}
          {!armed && poster && !posterFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover bg-black"
              onError={() => setPosterFailed(true)}
            />
          ) : null}
          <video
            ref={videoRef}
            src={src || undefined}
            poster={
              !hidePoster && !posterFailed && poster ? poster : undefined
            }
            playsInline
            // Loop only after a full playthrough — do not remount src while buffering.
            loop
            muted={muted}
            preload={armed && active ? "auto" : "none"}
            controls={false}
            controlsList="nodownload noremoteplayback"
            onPlaying={() => {
              setPlaying(true);
              setHidePoster(true);
            }}
            onPause={() => {
              // Ignore transient pause events while the element is still the active source
              // and the user did not press Pause (e.g. brief stalls). Keep UI in sync only
              // when the element is actually paused after event settles.
              const el = videoRef.current;
              if (el && !el.paused) return;
              setPlaying(false);
            }}
            onError={() => {
              setPosterFailed(true);
              setPlaying(false);
            }}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover bg-black"
          />

          {/* Center Play / Pause only — do not cover the prompt / Show more area. */}
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center pb-28">
            {playing ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePauseClick();
                }}
                className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/30 transition active:scale-95"
                aria-label={t.assets.pause}
              >
                <Pause className="h-6 w-6" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayClick();
                }}
                className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition active:scale-95"
                aria-label={t.assets.play}
              >
                <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          {item.status === "failed" ? (
            <>
              <div className="absolute inset-0 bg-black/80" />
              <span className="relative z-10 rounded-xl bg-rose-500/20 px-4 py-2 text-lg font-bold text-rose-100 ring-1 ring-rose-400/40">
                {t.assets.failed}
              </span>
              {item.error?.includes("تم استرجاع") ||
              item.error?.toLowerCase().includes("refund") ? (
                <p className="relative z-10 mt-1 max-w-xs text-xs text-emerald-200/90">
                  {t.assets.creditReturned}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {poster && !posterFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                  onError={() => setPosterFailed(true)}
                />
              ) : null}
              <span className="relative z-10 text-base font-semibold text-white">
                {item.status === "running" ? t.assets.generating : item.status}
              </span>
              {item.status === "running" && (
                <div className="relative z-10">
                  <RunningCountdown
                    assetId={item.id}
                    createdAt={item.createdAt}
                    targetSeconds={inferTargetSecondsFromAsset(item)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Soft bottom gradient for prompt readability — paused / stopped */}
      {!playing ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      ) : null}

      {/* Side actions — visible when paused (after Pause or before Play) */}
      {!playing ? (
      <div className="absolute bottom-28 left-2 z-40 flex flex-col items-center gap-2 sm:bottom-32 sm:left-4">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleEdit();
            }}
            disabled={editing || item.status === "running"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.edit}
          >
            {editing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Pencil className="h-5 w-5" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">{t.assets.edit}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete();
            }}
            disabled={deleting}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/30 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.delete}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">{t.assets.delete}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDownload();
            }}
            disabled={
              downloading ||
              item.status !== "completed" ||
              !(item.url || item.historyId)
            }
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.download}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">{t.assets.download}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md"
          aria-label={muted ? t.assets.unmute : t.assets.mute}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      ) : null}

      {/* Title + meta — above play control so Show more is always tappable.
          Keep visible while playing when the prompt sheet is open. */}
      {!playing || promptExpanded ? (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-16 z-40 px-3 pb-[env(safe-area-inset-bottom)] pl-16 sm:bottom-20 sm:px-6 sm:pl-24"
        dir={dir}
      >
        <div className="pointer-events-auto max-w-[min(100%,28rem)]">
          {!playing ? (
            <>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#22f0ff]/90">
                {t.create.createdBy}
              </p>
              <h2 className="text-base font-extrabold leading-snug text-white sm:text-lg">
                {title}
              </h2>
            </>
          ) : null}
          {prompt ? (
            <AssetPromptPanel
              prompt={prompt}
              expanded={promptExpanded}
              long={promptLong}
              onToggle={() => setPromptExpanded((v) => !v)}
              showMoreLabel={t.assets.showMore}
              showLessLabel={t.assets.showLess}
              footer={!playing ? <VideoMetaNotes item={item} /> : null}
            />
          ) : !playing ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="text-sm text-white/50">{t.assets.noPrompt}</p>
              <VideoMetaNotes item={item} />
            </div>
          ) : null}
          {!playing && item.error ? (
            <p className="mt-1 whitespace-pre-line text-xs font-medium leading-relaxed text-rose-300">
              {displayBytePlusAssetError(item.error)}
            </p>
          ) : null}
        </div>
      </div>
      ) : null}
    </section>
  );
}

function GridVideoTile({
  item,
  onOpen,
}: {
  item: AssetItem;
  onOpen: (id: string) => void;
}) {
  const { t, dir } = useLocale();
  const poster = veronixPosterSrc({
    url: item.url,
    historyId: item.historyId,
  });
  const title = assetPromptTitle(item.prompt) || "فيديو";
  const running = item.status === "running" || item.status === "pending";
  const failed = item.status === "failed";
  const ratio = String(item.aspectRatio || "16:9").trim();
  const portrait =
    ratio === "9:16" || ratio === "3:4" || ratio === "2:3" || ratio === "4:5";

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="group relative overflow-hidden rounded-xl bg-[#10141c] text-right ring-1 ring-white/10 transition hover:ring-white/25"
      dir={dir}
    >
      <div
        className={`relative bg-black/50 ${
          portrait ? "aspect-[3/4]" : "aspect-video"
        }`}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-sm font-semibold text-rose-200/90">
            {failed ? t.assets.failed : running ? t.assets.generating : (
              <Play className="h-8 w-8 text-white/30" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {running ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/45">
            <GenerateClock
              startedAt={lockEtaStart(item.id, item.createdAt)}
              size="card"
            />
          </div>
        ) : failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rounded-lg bg-black/70 px-2 py-1 text-xs font-bold text-rose-200">
              {t.assets.failed}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-70 transition group-hover:opacity-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/25">
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">
            {title}
          </p>
          <VideoMetaNotes item={item} compact />
        </div>
      </div>
    </button>
  );
}

function GridImageTile({
  item,
  onOpen,
}: {
  item: AssetItem;
  onOpen: (id: string) => void;
}) {
  const { t, dir } = useLocale();
  const src = veronixMediaSrc({
    historyId: item.historyId,
    url: item.url,
    mediaType: "image",
  });
  const title = assetPromptTitle(item.prompt) || "صورة";
  const running = item.status === "running" || item.status === "pending";
  const failed = item.status === "failed";

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="group relative overflow-hidden rounded-xl bg-[#10141c] text-right ring-1 ring-white/10 transition hover:ring-white/25"
      dir={dir}
    >
      <div className="relative aspect-[3/4] bg-black/50">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-sm font-semibold text-rose-200/90">
            {failed ? t.assets.failed : running ? t.assets.generating : item.status}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {running ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/45">
            <GenerateClock
              startedAt={lockEtaStart(item.id, item.createdAt)}
              size="card"
            />
          </div>
        ) : failed && src ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rounded-lg bg-black/70 px-2 py-1 text-xs font-bold text-rose-200">
              {t.assets.failed}
            </span>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">
            {title}
          </p>
          {item.aspectRatio || item.resolution ? (
            <p className="truncate text-[9px] font-medium text-white/70">
              {[item.resolution, item.aspectRatio].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function FeedImageSlide({
  item,
  onDeleted,
}: {
  item: AssetItem;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const { t, dir } = useLocale();
  const [deleting, setDeleting] = useState(false);
  const [makingVideo, setMakingVideo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const src = veronixMediaSrc({
    historyId: item.historyId,
    url: item.url,
    mediaType: "image",
  });
  const prompt = cleanAssetPrompt(item.prompt);
  const title = assetPromptTitle(item.prompt);
  const promptLong = prompt.length > 90;
  const running = item.status === "running" || item.status === "pending";

  const handleEdit = async () => {
    if (editing) return;
    setEditing(true);
    try {
      // Re-fetch the asset so character stills are not missing from a stale cache.
      let savedRefs = Array.isArray(item.referenceImages)
        ? item.referenceImages
        : [];
      let editPrompt = prompt || item.prompt || "";
      let aspectRatio = item.aspectRatio;
      let resolution = item.resolution;
      try {
        const { res, data } = await fetchJson<{
          assets?: Array<{
            id: string;
            prompt?: string;
            aspectRatio?: string;
            resolution?: string;
            referenceImages?: typeof item.referenceImages;
          }>;
        }>("/api/assets");
        if (res.ok) {
          const asset = (data.assets || []).find((a) => a.id === item.id);
          if (asset?.prompt) editPrompt = cleanAssetPrompt(asset.prompt) || asset.prompt;
          if (asset?.aspectRatio) aspectRatio = asset.aspectRatio;
          if (asset?.resolution) resolution = asset.resolution;
          if (Array.isArray(asset?.referenceImages) && asset.referenceImages.length) {
            savedRefs = asset.referenceImages;
          }
        }
      } catch {
        // keep list item refs
      }

      let characters = await prepareCharacterRefsForEdit(savedRefs);

      // Last resort only when the asset never stored character stills.
      if (!characters.length && item.url) {
        const url = (await hydrateRefImageUrl(item.url)) || item.url;
        if (url) {
          characters = [
            {
              type: "image",
              id: `edit-img-ref-${item.id}`,
              url,
              label: "من الصورة",
            },
          ];
        }
      }

      writeEditDraft({
        prompt: editPrompt,
        media: "image",
        startFrame: null,
        referenceImages: characters,
        sourceAssetId: item.id,
        aspectRatio,
        resolution,
      });
      router.push("/create/image?edit=1");
    } finally {
      setEditing(false);
    }
  };

  const handleMakeVideo = async () => {
    if (makingVideo || item.status !== "completed" || !item.url) return;
    setMakingVideo(true);
    try {
      const url = (await hydrateRefImageUrl(item.url)) || item.url;
      if (!url) throw new Error("تعذر تحميل الصورة");
      writeEditDraft({
        prompt: prompt || item.prompt || "",
        media: "video",
        startFrame: {
          type: "image",
          id: `start-from-img-${item.id}`,
          url,
          label: "start-frame",
        },
        referenceImages: [],
        useAsStartFrame: true,
        sourceAssetId: item.id,
        aspectRatio: item.aspectRatio,
        resolution:
          item.resolution && ["480p", "720p"].includes(item.resolution)
            ? item.resolution
            : "720p",
      });
      router.push("/create/video?edit=1");
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "تعذر فتح توليد الفيديو",
      );
    } finally {
      setMakingVideo(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm("حذف هذه الصورة من Assets؟")) return;
    setDeleting(true);
    try {
      const { res, data } = await fetchJson<{ error?: string }>("/api/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!res.ok) throw new Error(data.error || "تعذر الحذف");
      onDeleted(item.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section
      data-asset-id={item.id}
      className="relative h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] w-full snap-start snap-always overflow-hidden bg-black"
    >
      {src && item.status !== "failed" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-6 text-center">
          {item.status === "failed" ? (
            <span className="rounded-xl bg-rose-500/20 px-4 py-2 text-lg font-bold text-rose-100 ring-1 ring-rose-400/40">
              {t.assets.failed}
            </span>
          ) : running ? (
            <>
              <GenerateClock
                startedAt={lockEtaStart(item.id, item.createdAt)}
                size="card"
              />
              <span className="text-sm font-semibold text-white">
                {t.assets.generating}
              </span>
            </>
          ) : (
            <span className="rounded-xl bg-rose-500/20 px-4 py-2 text-lg font-bold text-rose-100 ring-1 ring-rose-400/40">
              {t.assets.failed}
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      <div className="absolute bottom-28 left-2 z-40 flex flex-col items-center gap-2 sm:bottom-32 sm:left-4">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => void handleEdit()}
            disabled={editing || running}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.edit}
          >
            {editing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Pencil className="h-5 w-5" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">
            {t.assets.edit}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => void handleMakeVideo()}
            disabled={makingVideo || item.status !== "completed" || !item.url}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#22f0ff]/20 text-[#22f0ff] ring-1 ring-[#22f0ff]/35 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.makeVideo}
          >
            {makingVideo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clapperboard className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">
            {t.assets.makeVideo}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/30 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.delete}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">
            {t.assets.delete}
          </span>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-16 z-40 px-3 pb-[env(safe-area-inset-bottom)] pl-16 sm:bottom-20 sm:px-6 sm:pl-24"
        dir={dir}
      >
        <div className="pointer-events-auto max-w-[min(100%,28rem)]">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#22f0ff]/90">
            {t.create.createdBy}
          </p>
          <h2 className="text-base font-extrabold leading-snug text-white sm:text-lg">
            {title}
          </h2>
          {prompt ? (
            <AssetPromptPanel
              prompt={prompt}
              expanded={promptExpanded}
              long={promptLong}
              onToggle={() => setPromptExpanded((v) => !v)}
              showMoreLabel={t.assets.showMore}
              showLessLabel={t.assets.showLess}
              footer={
                item.resolution || item.aspectRatio ? (
                  <p className="text-[10px] font-semibold text-white/70">
                    {[item.resolution, item.aspectRatio]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null
              }
            />
          ) : (
            <p className="mt-1.5 text-sm text-white/50">{t.assets.noPrompt}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function useActiveSlide(
  containerRef: RefObject<HTMLElement | null>,
  itemCount: number,
) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-asset-id]"));
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-asset-id");
          if (!id) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { id, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio >= 0.55) setActiveId(best.id);
      },
      { root, threshold: [0.35, 0.55, 0.75, 0.9] },
    );
    for (const slide of slides) observer.observe(slide);
    setActiveId(slides[0]?.getAttribute("data-asset-id") || null);
    return () => observer.disconnect();
  }, [containerRef, itemCount]);

  return activeId;
}

export function AssetsPage() {
  const { t, dir, locale } = useLocale();
  const { user, sessionReady, logout } = useCustomerSession();
  const [assets, setAssets] = useState<AssetItem[]>(() => readAssetsCache() || []);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"video" | "image">("video");
  const [viewMode, setViewMode] = useState<VideoViewMode>("browse");
  const [gridZoom, setGridZoom] = useState(2);
  const [focusAssetId, setFocusAssetId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(() => !readAssetsCache()?.length);
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setViewMode(readStoredViewMode());
    setGridZoom(readStoredGridZoom());
  }, []);

  // Create Result preview → Assets deep link: /assets?type=image|video&id=…
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const typeRaw = (sp.get("type") || sp.get("media") || "").toLowerCase();
    const id = (sp.get("id") || sp.get("focus") || sp.get("asset") || "").trim();
    let changed = false;
    if (typeRaw === "image" || typeRaw === "photo" || typeRaw === "photos") {
      setFilter("image");
      changed = true;
    } else if (typeRaw === "video" || typeRaw === "videos") {
      setFilter("video");
      changed = true;
    }
    if (id) {
      setFocusAssetId(id);
      setViewMode("browse");
      try {
        sessionStorage.setItem(VIEW_MODE_KEY, "browse");
      } catch {
        // ignore
      }
      changed = true;
    }
    if (changed) {
      window.history.replaceState({}, "", "/assets");
    }
  }, []);

  const setVideoViewMode = useCallback((mode: VideoViewMode) => {
    setViewMode(mode);
    try {
      sessionStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const setVideoGridZoom = useCallback((zoom: number) => {
    const next = Math.min(
      GRID_ZOOM_MAX,
      Math.max(GRID_ZOOM_MIN, Math.round(zoom)),
    );
    setGridZoom(next);
    try {
      sessionStorage.setItem(GRID_ZOOM_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const loadAssets = useCallback(async (opts?: { sync?: boolean }) => {
    const qs = opts?.sync ? "?sync=1" : "";
    const { res, data } = await fetchJson<{ assets?: AssetItem[]; error?: string }>(
      `/api/assets${qs}`,
    );
    if (!res.ok) {
      if (res.status === 401) {
        clearAssetsCache();
        setAssets([]);
        setError("سجّل الدخول لعرض ملفاتك.");
        return;
      }
      // Keep cached tiles visible if a background refresh fails.
      if (!opts?.sync) setError(data.error || "Failed to load assets");
      return;
    }
    setError(null);
    const next = (data.assets || []).filter((a) => a.mode !== "sequence-part");
    setAssets(next);
    writeAssetsCache(next);
    if (!opts?.sync) {
      warmAssetPosters(next, (item) =>
        veronixPosterSrc({ url: item.url, historyId: item.historyId }),
      );
    }
    for (const a of next) {
      if (a.status === "completed" || a.status === "failed") {
        clearEtaStart(a.id);
      }
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    void (async () => {
      const cached = readAssetsCache();
      if (cached?.length) {
        setAssets(cached);
        setLoading(false);
      }

      if (!user) {
        clearAssetsCache();
        setAssets([]);
        setError("سجّل الدخول لعرض ملفاتك.");
        setLoading(false);
        return;
      }

      await loadAssets();
      if (cancelled) return;
      setLoading(false);
      // Background sync only when something may still be generating —
      // avoid heavy stitch/clarity work on every Assets open.
      const cachedNow = readAssetsCache() || [];
      const needsSync = cachedNow.some(
        (a) => a.status === "running" || a.status === "pending",
      );
      if (needsSync) {
        void loadAssets({ sync: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, user?.id, loadAssets]);

  useEffect(() => {
    const hasRunning = assets.some((a) => a.status === "running");
    if (!hasRunning || !user) return;
    const t = window.setInterval(() => {
      void loadAssets({ sync: true });
    }, 8000);
    return () => window.clearInterval(t);
  }, [assets, user, loadAssets]);

  const videos = assets.filter((a) => a.mediaType === "video");
  const images = assets.filter((a) => a.mediaType === "image");
  const browseCount =
    viewMode === "browse"
      ? filter === "video"
        ? videos.length
        : images.length
      : 0;
  const activeId = useActiveSlide(feedRef, browseCount);

  useEffect(() => {
    if (viewMode !== "browse" || !focusAssetId) return;
    const id = focusAssetId;
    const frame = window.requestAnimationFrame(() => {
      const root = feedRef.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(
        `[data-asset-id="${CSS.escape(id)}"]`,
      );
      el?.scrollIntoView({ block: "start" });
      setFocusAssetId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewMode, focusAssetId, videos.length, images.length, filter]);

  const openVideoInBrowse = useCallback(
    (id: string) => {
      setFocusAssetId(id);
      setVideoViewMode("browse");
    },
    [setVideoViewMode],
  );

  const openImageInBrowse = useCallback(
    (id: string) => {
      setFocusAssetId(id);
      setVideoViewMode("browse");
    },
    [setVideoViewMode],
  );

  const onDeletedAsset = useCallback((id: string) => {
    setAssets((prev) => {
      const next = prev.filter((a) => a.id !== id);
      writeAssetsCache(next);
      return next;
    });
  }, []);

  if (filter === "video") {
    return (
      <div className="relative min-h-[100dvh] bg-black text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 via-black/50 to-transparent">
          <div className="pointer-events-auto">
            <AppHeader
              compact
              user={user}
              sessionReady={sessionReady}
              onLogout={() => {
                void logout().then(() => {
                  setAssets([]);
                  clearAssetsCache();
                });
              }}
            />
          </div>
          <div className="pointer-events-auto px-3 pb-2.5 pt-1 sm:px-4" dir={dir}>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg font-extrabold leading-none sm:text-xl">
                  {t.nav.assets}
                </p>
                <p className="mt-1 text-[10px] text-white/45 sm:text-[11px]">
                  {viewMode === "browse" ? t.assets.swipeUp : t.assets.gridHint}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setFilter("video")}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black"
                >
                  {t.assets.video}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("image")}
                  className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80"
                >
                  {t.assets.photos}
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex shrink-0 rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
                <button
                  type="button"
                  onClick={() => setVideoViewMode("browse")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                    viewMode === "browse"
                      ? "bg-white text-black"
                      : "text-white/75 hover:text-white"
                  }`}
                >
                  <Rows3 className="h-3.5 w-3.5" />
                  {t.assets.browse}
                </button>
                <button
                  type="button"
                  onClick={() => setVideoViewMode("grid")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                    viewMode === "grid"
                      ? "bg-white text-black"
                      : "text-white/75 hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {t.assets.grid}
                </button>
              </div>

              {viewMode === "grid" ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/15">
                  <ZoomOut className="h-3.5 w-3.5 shrink-0 text-white/55" />
                  <input
                    type="range"
                    min={GRID_ZOOM_MIN}
                    max={GRID_ZOOM_MAX}
                    step={1}
                    value={gridZoom}
                    onChange={(e) => setVideoGridZoom(Number(e.target.value))}
                    className="h-1.5 w-full min-w-0 accent-[#22f0ff]"
                    aria-label={t.assets.zoom}
                  />
                  <ZoomIn className="h-3.5 w-3.5 shrink-0 text-white/55" />
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/70">
                    {gridZoom}×
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-sm text-white/70">
            {error}{" "}
            <Link href="/login?next=/assets" className="text-[#22f0ff]">
              دخول
            </Link>
          </div>
        )}

        {!error && loading && videos.length === 0 && (
          <div className="flex min-h-[100dvh] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#22f0ff]" />
          </div>
        )}

        {!error && !loading && videos.length === 0 && (
          <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-white/50">لا توجد فيديوهات بعد.</p>
            <Link
              href="/create/video"
              className="rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2 text-sm font-semibold"
            >
              إنشاء فيديو
            </Link>
          </div>
        )}

        {!error && videos.length > 0 && viewMode === "browse" && (
          <div
            ref={feedRef}
            className="h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
            style={{ scrollSnapType: "y mandatory" }}
          >
            {videos.map((item, index) => {
              const activeIndex = Math.max(
                0,
                videos.findIndex((v) => v.id === activeId),
              );
              const loadMedia = Math.abs(index - activeIndex) <= 1;
              return (
                <FeedVideoSlide
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  loadMedia={loadMedia}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                  onDeleted={(id) => {
                    setAssets((prev) => {
                      const next = prev.filter((a) => a.id !== id);
                      writeAssetsCache(next);
                      return next;
                    });
                  }}
                />
              );
            })}
          </div>
        )}

        {!error && videos.length > 0 && viewMode === "grid" && (
          <div className="h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-y-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[7.75rem] sm:px-3 sm:pt-36">
            <div
              className="mx-auto grid max-w-6xl gap-2 sm:gap-2.5"
              style={{
                gridTemplateColumns: `repeat(${gridZoom}, minmax(0, 1fr))`,
              }}
            >
              {videos.map((item) => (
                <GridVideoTile
                  key={item.id}
                  item={item}
                  onOpen={openVideoInBrowse}
                />
              ))}
            </div>
          </div>
        )}

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 via-black/50 to-transparent">
        <div className="pointer-events-auto">
          <AppHeader
            compact
            user={user}
            sessionReady={sessionReady}
            onLogout={() => {
              void logout().then(() => {
                setAssets([]);
                clearAssetsCache();
              });
            }}
          />
        </div>
        <div className="pointer-events-auto px-3 pb-2.5 pt-1 sm:px-4" dir={dir}>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold leading-none sm:text-xl">
                {t.nav.assets}
              </p>
              <p className="mt-1 text-[10px] text-white/45 sm:text-[11px]">
                {viewMode === "browse"
                  ? t.assets.swipeUp
                  : t.assets.photosGridHint}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setFilter("video")}
                className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80"
              >
                {t.assets.video}
              </button>
              <button
                type="button"
                onClick={() => setFilter("image")}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black"
              >
                {t.assets.photos}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex shrink-0 rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
              <button
                type="button"
                onClick={() => setVideoViewMode("browse")}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  viewMode === "browse"
                    ? "bg-white text-black"
                    : "text-white/75 hover:text-white"
                }`}
              >
                <Rows3 className="h-3.5 w-3.5" />
                {t.assets.browse}
              </button>
              <button
                type="button"
                onClick={() => setVideoViewMode("grid")}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  viewMode === "grid"
                    ? "bg-white text-black"
                    : "text-white/75 hover:text-white"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t.assets.grid}
              </button>
            </div>

            {viewMode === "grid" ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/15">
                <ZoomOut className="h-3.5 w-3.5 shrink-0 text-white/55" />
                <input
                  type="range"
                  min={GRID_ZOOM_MIN}
                  max={GRID_ZOOM_MAX}
                  step={1}
                  value={gridZoom}
                  onChange={(e) => setVideoGridZoom(Number(e.target.value))}
                  className="h-1.5 w-full min-w-0 accent-[#22f0ff]"
                  aria-label={t.assets.zoom}
                />
                <ZoomIn className="h-3.5 w-3.5 shrink-0 text-white/55" />
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/70">
                  {gridZoom}×
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-sm text-white/70">
          {error}{" "}
          <Link href="/login?next=/assets" className="text-[#22f0ff]">
            دخول
          </Link>
        </div>
      )}

      {!error && loading && images.length === 0 && (
        <div className="flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#22f0ff]" />
        </div>
      )}

      {!error && !loading && images.length === 0 && (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-white/50">لا توجد صور بعد.</p>
          <Link
            href="/create/image"
            className="rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2 text-sm font-semibold"
          >
            إنشاء صورة
          </Link>
        </div>
      )}

      {!error && images.length > 0 && viewMode === "browse" && (
        <div
          ref={feedRef}
          className="h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {images.map((item) => (
            <FeedImageSlide
              key={item.id}
              item={item}
              onDeleted={onDeletedAsset}
            />
          ))}
        </div>
      )}

      {!error && images.length > 0 && viewMode === "grid" && (
        <div className="h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-y-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[7.75rem] sm:px-3 sm:pt-36">
          <div
            className="mx-auto grid max-w-6xl gap-2 sm:gap-2.5"
            style={{
              gridTemplateColumns: `repeat(${gridZoom}, minmax(0, 1fr))`,
            }}
          >
            {images.map((item) => (
              <GridImageTile
                key={item.id}
                item={item}
                onOpen={openImageInBrowse}
              />
            ))}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
