"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  LayoutGrid,
  Loader2,
  Check,
  Pause,
  Pencil,
  Play,
  Rows3,
  Scissors,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppHeader } from "./AppHeader";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { BottomNav } from "./BottomNav";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearEtaStart,
  inferTargetSecondsFromAsset,
  lockEtaStart,
} from "@/lib/generate-eta";
import { writeEditDraft } from "@/lib/edit-draft";
import { sendVideoToEditStudio, sendVideosToEditStudio } from "@/lib/send-to-edit-studio";
import { assetToClipInput } from "@/lib/edit-studio-timeline";
import { assetModelLabel } from "@/lib/model-logos";
import { shareAsset } from "@/lib/share-asset";
import { isRecoverableProviderAsset } from "@/lib/recover-provider-asset-utils";
import {
  hydrateReferenceImages,
  hydrateRefImageUrl,
} from "@/lib/hydrate-ref-images";
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

  const modelName = assetModelLabel(item.model, item.historyId);
  if (modelName) chips.push(modelName);

  const audio =
    typeof item.generateAudio === "boolean"
      ? item.generateAudio
      : typeof item.jobMeta?.generateAudio === "boolean"
        ? item.jobMeta.generateAudio
        : undefined;
  if (typeof audio === "boolean") {
    const isMiniMax =
      item.model === "minimax-h3" || item.historyId?.startsWith("mm:");
    if (!isMiniMax) {
      chips.push(audio ? labels.withAudio : labels.noAudio);
    }
  }
  return chips;
}

function VideoMetaNotes({
  item,
  className = "",
}: {
  item: AssetItem;
  className?: string;
}) {
  const { t, dir } = useLocale();
  const chips = videoMetaChips(item, {
    withAudio: t.assets.withAudio,
    noAudio: t.assets.noAudio,
    clarityMark: t.assets.clarityMark,
  });
  if (!chips.length) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
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

function RunningCountdown({
  assetId,
  createdAt,
}: {
  assetId: string;
  createdAt: string;
  targetSeconds: number;
}) {
  const started = lockEtaStart(assetId, createdAt);
  return <GenerateClock startedAt={started} size="large" />;
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

function isRecoverableAsset(item: AssetItem): boolean {
  return isRecoverableProviderAsset(item);
}

function FeedVideoSlide({
  item,
  active,
  loadMedia,
  muted,
  onToggleMute,
  onDeleted,
  onRecover,
  referralCode,
  selected,
  onToggleSelect,
}: {
  item: AssetItem;
  active: boolean;
  /** Load poster/proxy only for active + neighbors — keeps Assets snappy. */
  loadMedia: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onDeleted: (id: string) => void;
  onRecover?: (id: string) => void | Promise<void>;
  referralCode?: string | null;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const { t, dir } = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [promptMenuOpen, setPromptMenuOpen] = useState(false);
  const promptMenuRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [sendingStudio, setSendingStudio] = useState(false);
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
  // Prefer historyId for PixVerse/BytePlus — stale CDN urls break playback.
  const poster = useMemo(
    () =>
      loadMedia
        ? veronixPosterSrc({
            historyId: item.historyId,
            url: item.url,
          })
        : null,
    [loadMedia, item.historyId, item.url],
  );
  const prompt = cleanAssetPrompt(item.prompt);
  const title = assetPromptTitle(item.prompt);
  const promptLong = prompt.length > 110;
  const canPlay =
    Boolean(mediaUrl) &&
    item.status !== "failed" &&
    item.status !== "running";

  useEffect(() => {
    setPromptMenuOpen(false);
    setPosterFailed(false);
    setPlaying(false);
    setArmed(false);
  }, [item.id]);

  useEffect(() => {
    if (!promptMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = promptMenuRef.current;
      if (root && !root.contains(event.target as Node)) {
        setPromptMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [promptMenuOpen]);

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
      // Always restore uploaded character stills first — never steal a video frame
      // when the asset already has referenceImages (frame = result scene, not faces).
      const savedRefs = Array.isArray(item.referenceImages)
        ? item.referenceImages.filter((r) => r?.url).slice(0, 4)
        : [];

      let characters = savedRefs.length
        ? await hydrateReferenceImages(savedRefs)
        : [];

      // If hydrate failed but we still have paths, keep the original URLs
      // (CreateStudio displays /generations via the stream proxy).
      if (!characters.length && savedRefs.length) {
        characters = savedRefs.map((r, i) => ({
          type: "image" as const,
          id: r.id || `edit-ref-${item.id}-${i}`,
          url: r.url,
          label: r.label || "",
        }));
      }

      // Only older assets without saved refs: capture a still as a character slot.
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

      const editDuration = inferTargetSecondsFromAsset(item);
      const liveVideoSec =
        videoRef.current &&
        Number.isFinite(videoRef.current.duration) &&
        videoRef.current.duration >= 4
          ? Math.min(15, Math.max(4, Math.round(videoRef.current.duration)))
          : null;
      const durationSec = item.targetSeconds || liveVideoSec || editDuration;

      writeEditDraft({
        prompt: prompt || item.prompt || "",
        media: "video",
        startFrame: null,
        referenceImages: characters,
        sourceAssetId: item.id,
        modelId: item.model,
        duration: durationSec,
        resolution: item.resolution,
        aspectRatio: item.aspectRatio,
        preferClarity: item.preferClarity,
      });
      const qs = new URLSearchParams({ edit: "1" });
      qs.set("duration", String(durationSec));
      if (item.model) qs.set("model", item.model);
      if (item.resolution) qs.set("resolution", item.resolution);
      if (item.aspectRatio) qs.set("aspect", item.aspectRatio);
      if (item.preferClarity) qs.set("clarity", "1");
      router.push(`/create/video?${qs.toString()}`);
    } finally {
      setEditing(false);
    }
  };

  const handleSendToStudio = () => {
    if (sendingStudio || !mediaUrl || item.status !== "completed") return;
    setSendingStudio(true);
    try {
      sendVideoToEditStudio(router, {
        videoUrl: mediaUrl,
        posterUrl: poster || undefined,
        assetId: item.id,
        historyId: item.historyId,
        prompt: prompt || item.prompt,
        durationSec: inferTargetSecondsFromAsset(item),
        aspectRatio: item.aspectRatio,
      });
    } finally {
      setSendingStudio(false);
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

  const canSelect =
    Boolean(mediaUrl) && item.status === "completed";

  return (
    <section
      data-asset-id={item.id}
      className={`relative h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] w-full snap-start snap-always overflow-hidden bg-black ${
        selected ? "ring-2 ring-inset ring-[#22f0ff]" : ""
      }`}
    >
      {canSelect && onToggleSelect ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`absolute end-3 top-[5.5rem] z-50 flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-md transition sm:top-[6rem] ${
            selected
              ? "border-[#22f0ff] bg-[#22f0ff]/25 text-[#22f0ff]"
              : "border-white/30 bg-black/45 text-white/80"
          }`}
          aria-pressed={selected}
          aria-label={t.assets.sendToStudio}
        >
          {selected ? (
            <Check className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <span className="h-4 w-4 rounded border-2 border-current" />
          )}
        </button>
      ) : null}
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
            poster={!posterFailed && poster ? poster : undefined}
            playsInline
            // Loop only after a full playthrough — do not remount src while buffering.
            loop
            muted={muted}
            preload={armed && active ? "auto" : "none"}
            controls={false}
            controlsList="nodownload noremoteplayback"
            onPlaying={() => setPlaying(true)}
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

          {/* Center Play / Pause buttons only — no tap-on-video. */}
          {playing ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
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
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
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
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
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
            {item.status === "running"
              ? t.assets.generating
              : item.status === "failed"
                ? item.error?.includes("تم استرجاع") ||
                  item.error?.toLowerCase().includes("refund")
                  ? t.assets.failedRefunded
                  : t.assets.failed
                : item.status}
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
          {item.status === "failed" &&
          (item.error?.includes("تم استرجاع") ||
            item.error?.toLowerCase().includes("refund")) ? (
            <p className="relative z-10 mt-1 max-w-xs text-xs text-emerald-200/90">
              {t.assets.creditReturned}
            </p>
          ) : null}
          {isRecoverableAsset(item) && onRecover ? (
            <button
              type="button"
              disabled={recovering}
              onClick={(e) => {
                e.stopPropagation();
                setRecovering(true);
                void Promise.resolve(onRecover(item.id)).finally(() =>
                  setRecovering(false),
                );
              }}
              className="relative z-10 mt-2 rounded-full bg-[#22f0ff]/20 px-3 py-1.5 text-xs font-bold text-[#22f0ff] ring-1 ring-[#22f0ff]/40 disabled:opacity-50"
            >
              {recovering ? "جاري الاسترجاع…" : "استرجاع الفيديو"}
            </button>
          ) : null}
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
              handleSendToStudio();
            }}
            disabled={
              sendingStudio || item.status === "running" || item.status !== "completed"
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7c5cff]/25 text-[#d4c4ff] ring-1 ring-[#7c5cff]/35 backdrop-blur-md disabled:opacity-40"
            aria-label={t.assets.sendToStudio}
          >
            {sendingStudio ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Scissors className="h-5 w-5" />
            )}
          </button>
          <span className="max-w-[4.5rem] text-center text-[9px] font-semibold leading-tight text-white/80">
            {t.assets.sendToStudio}
          </span>
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
              void (async () => {
                setSharing(true);
                setShareNote(null);
                const result = await shareAsset(
                  { prompt, referralCode, locale: dir === "rtl" ? "ar" : "en" },
                  "native",
                );
                setShareNote(
                  result.ok ? t.create.resultShare : t.invite.shareFailed,
                );
                setSharing(false);
              })();
            }}
            disabled={sharing || item.status !== "completed"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#22f0ff]/15 text-[#22f0ff] ring-1 ring-[#22f0ff]/30 backdrop-blur-md disabled:opacity-40"
            aria-label={t.create.resultShare}
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">{t.create.resultShare}</span>
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

      {/* Title + meta — shown when paused / stopped */}
      {!playing ? (
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
            <div className="relative mt-1.5" ref={promptMenuRef}>
              <p className="line-clamp-2 text-sm leading-relaxed text-white/80 sm:text-[15px]">
                {prompt}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {promptLong ? (
                  <button
                    type="button"
                    aria-expanded={promptMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPromptMenuOpen((v) => !v);
                    }}
                    className="text-xs font-semibold text-white/95 underline-offset-2 hover:underline"
                  >
                    {promptMenuOpen ? t.assets.showLess : t.assets.showMore}
                  </button>
                ) : null}
                <VideoMetaNotes item={item} />
              </div>
              {promptLong && promptMenuOpen ? (
                <div
                  className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-[min(100%,28rem)] overflow-hidden rounded-xl border border-white/15 bg-[#0d1118]/96 shadow-2xl ring-1 ring-black/40 backdrop-blur-md"
                  dir={dir}
                >
                  <div className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-[#22f0ff]/90">
                    {t.assets.promptLabel}
                  </div>
                  <div className="max-h-[min(42vh,260px)] overflow-y-auto overscroll-contain px-3 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90 sm:text-[15px]">
                      {prompt}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="text-sm text-white/50">{t.assets.noPrompt}</p>
              <VideoMetaNotes item={item} />
            </div>
          )}
          {item.error ? (
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
  selected,
  onToggleSelect,
}: {
  item: AssetItem;
  onOpen: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { dir } = useLocale();
  const [posterFailed, setPosterFailed] = useState(false);
  // Prefer historyId for PixVerse/BytePlus posters in Assets grid tiles.
  const poster = veronixPosterSrc({
    historyId: item.historyId,
    url: item.url,
  });
  const mediaUrl = veronixMediaSrc({
    historyId: item.historyId,
    url: item.url,
    mediaType: "video",
  });
  const title = assetPromptTitle(item.prompt) || "فيديو";
  const running = item.status === "running" || item.status === "pending";
  const canSelect = Boolean(mediaUrl) && item.status === "completed";
  const ratio = String(item.aspectRatio || "16:9").trim();
  const portrait =
    ratio === "9:16" || ratio === "3:4" || ratio === "2:3" || ratio === "4:5";

  useEffect(() => {
    setPosterFailed(false);
  }, [item.id, item.url, poster]);

  return (
    <div className="relative">
      {canSelect && onToggleSelect ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`absolute start-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm ${
            selected
              ? "border-[#22f0ff] bg-[#22f0ff]/25 text-[#22f0ff]"
              : "border-white/25 bg-black/50 text-white/80"
          }`}
          aria-pressed={selected}
        >
          {selected ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <span className="h-3.5 w-3.5 rounded border-2 border-current" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className={`group relative w-full overflow-hidden rounded-lg bg-[#10141c] text-right ring-1 transition hover:ring-white/25 ${
          selected ? "ring-2 ring-[#22f0ff]" : "ring-white/10"
        }`}
        dir={dir}
      >
      <div
        className={`relative bg-black/50 ${
          portrait ? "aspect-[3/4]" : "aspect-video"
        }`}
      >
        {poster && !posterFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setPosterFailed(true)}
          />
        ) : mediaUrl && !running ? (
          <video
            src={mediaUrl}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">
            <Play className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        {running ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2 className="h-6 w-6 animate-spin text-[#22f0ff]" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-80 transition group-hover:opacity-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-md">
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-1.5">
          <p className="line-clamp-1 text-[10px] font-semibold leading-snug text-white sm:line-clamp-2 sm:text-[11px]">
            {title}
          </p>
          <VideoMetaNotes item={item} className="mt-1" />
        </div>
      </div>
    </button>
    </div>
  );
}

function ImageTile({
  item,
  onDeleted,
}: {
  item: AssetItem;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const src = veronixMediaSrc({
    historyId: item.historyId,
    url: item.url,
    mediaType: "image",
  });
  const prompt = cleanAssetPrompt(item.prompt);

  return (
    <article className="relative overflow-hidden rounded-2xl bg-[#10141c]">
      <div className="aspect-[3/4] bg-black/40">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            {item.status}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3" dir="rtl">
        <h3 className="text-sm font-extrabold text-white">
          {assetPromptTitle(item.prompt)}
        </h3>
        <p className="line-clamp-3 text-sm text-white/75">{prompt}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                let characters = await hydrateReferenceImages(
                  item.referenceImages,
                );
                if (!characters.length && item.url) {
                  const url = await hydrateRefImageUrl(item.url);
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
                  prompt: prompt || item.prompt || "",
                  media: "image",
                  startFrame: null,
                  referenceImages: characters,
                  sourceAssetId: item.id,
                  modelId: item.model,
                  aspectRatio: item.aspectRatio,
                  resolution: item.resolution,
                });
                router.push(
                  `/create/image?edit=1${item.model ? `&model=${encodeURIComponent(item.model)}` : ""}`,
                );
              })();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22f0ff]"
          >
            <Pencil className="h-3.5 w-3.5" />
            تعديل
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              void (async () => {
                if (deleting) return;
                if (!window.confirm("حذف هذه الصورة من Assets؟")) return;
                setDeleting(true);
                try {
                  const { res, data } = await fetchJson<{ error?: string }>(
                    "/api/assets",
                    {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: item.id }),
                    },
                  );
                  if (!res.ok) throw new Error(data.error || "تعذر الحذف");
                  onDeleted(item.id);
                } catch (err) {
                  window.alert(
                    err instanceof Error ? err.message : "تعذر الحذف",
                  );
                } finally {
                  setDeleting(false);
                }
              })();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            حذف
          </button>
        </div>
      </div>
    </article>
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
  const router = useRouter();
  const { user, ready, refreshing, logout } = useCustomerUser();
  const [assets, setAssets] = useState<AssetItem[]>(() => readAssetsCache() || []);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"video" | "image">("video");
  const [viewMode, setViewMode] = useState<VideoViewMode>("browse");
  const [gridZoom, setGridZoom] = useState(2);
  const [focusAssetId, setFocusAssetId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(() => !readAssetsCache()?.length);
  const [recoverNote, setRecoverNote] = useState<string | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setViewMode(readStoredViewMode());
    setGridZoom(readStoredGridZoom());
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

  const recoverAsset = useCallback(async (assetId?: string, opts?: { silent?: boolean }) => {
    const { res, data } = await fetchJson<{
      assets?: AssetItem[];
      message?: string;
      error?: string;
    }>("/api/assets/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assetId ? { id: assetId } : {}),
    });
    if (!res.ok) {
      if (!opts?.silent) {
        setRecoverNote(data.error || "تعذر استرجاع الفيديو");
      }
      return;
    }
    clearAssetsCache();
    const next = (data.assets || []).filter((a) => a.mode !== "sequence-part");
    setAssets(next);
    writeAssetsCache(next);
    if (!opts?.silent) {
      setRecoverNote(data.message || null);
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
    if (!ready) return;
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
      const cachedNow = readAssetsCache() || [];
      const needsSync = cachedNow.some(
        (a) => a.status === "running" || a.status === "pending",
      );
      const needsRecover = cachedNow.some((a) => isRecoverableProviderAsset(a));
      if (needsSync) {
        void loadAssets({ sync: true });
      } else if (needsRecover) {
        void recoverAsset(undefined, { silent: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, loadAssets, recoverAsset]);

  useEffect(() => {
    const hasRunning = assets.some(
      (a) => a.status === "running" || a.status === "pending",
    );
    const hasRecoverable = assets.some((a) => isRecoverableProviderAsset(a));
    if ((!hasRunning && !hasRecoverable) || !user) return;
    const t = window.setInterval(() => {
      if (hasRunning) {
        void loadAssets({ sync: true });
      } else if (hasRecoverable) {
        void recoverAsset(undefined, { silent: true });
      }
    }, hasRunning ? 8000 : 20_000);
    return () => window.clearInterval(t);
  }, [assets, user, loadAssets, recoverAsset]);

  const videos = assets.filter((a) => a.mediaType === "video");
  const images = assets.filter((a) => a.mediaType === "image");
  const activeId = useActiveSlide(
    feedRef,
    viewMode === "browse" ? videos.length : 0,
  );

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
  }, [viewMode, focusAssetId, videos.length]);

  const openVideoInBrowse = useCallback(
    (id: string) => {
      setFocusAssetId(id);
      setVideoViewMode("browse");
    },
    [setVideoViewMode],
  );

  const toggleVideoSelection = useCallback((id: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearVideoSelection = useCallback(() => {
    setSelectedVideoIds(new Set());
  }, []);

  const buildClipInputsFromSelection = useCallback(
    (ids: Set<string>) => {
      return videos
        .filter((v) => ids.has(v.id) && v.status === "completed" && v.url)
        .map((v) =>
          assetToClipInput(
            v,
            veronixMediaSrc({
              historyId: v.historyId,
              url: v.url,
              mediaType: "video",
            }),
            veronixPosterSrc({ historyId: v.historyId, url: v.url }),
          ),
        )
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    },
    [videos],
  );

  const sendSelectedVideosToStudio = useCallback(() => {
    const inputs = buildClipInputsFromSelection(selectedVideoIds);
    if (!inputs.length) return;
    sendVideosToEditStudio(router, inputs);
    clearVideoSelection();
  }, [
    buildClipInputsFromSelection,
    selectedVideoIds,
    router,
    clearVideoSelection,
  ]);

  const selectionCount = selectedVideoIds.size;

  if (filter === "video") {
    return (
      <div className="relative min-h-[100dvh] bg-black text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 via-black/50 to-transparent">
          <div className="pointer-events-auto">
            <AppHeader
              compact
              user={user}
              ready={ready}
              refreshing={refreshing}
              onLogout={() => {
                void logout().then(() => {
                  setAssets([]);
                  clearAssetsCache();
                });
              }}
            />
          </div>
          <div className="pointer-events-auto px-3 pb-2 sm:px-4" dir={dir}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base font-extrabold sm:text-lg">Assets</p>
                <p className="text-[10px] text-white/45 sm:text-[11px]">
                  {viewMode === "browse" ? t.assets.swipeUp : t.assets.gridHint}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilter("video")}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black sm:px-3 sm:text-xs"
                >
                  {t.assets.video}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("image")}
                  className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 sm:px-3 sm:text-xs"
                >
                  {t.assets.photos}
                </button>
                <Link
                  href="/edit"
                  className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 sm:px-3 sm:text-xs"
                >
                  {t.editStudio.tab}
                </Link>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
                <button
                  type="button"
                  onClick={() => setVideoViewMode("browse")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] ${
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
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] ${
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
                    className="h-1.5 w-full min-w-[4.5rem] accent-[#22f0ff]"
                    aria-label={t.assets.zoom}
                  />
                  <ZoomIn className="h-3.5 w-3.5 shrink-0 text-white/55" />
                  <span className="shrink-0 text-[10px] font-semibold text-white/70">
                    {gridZoom}×
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {recoverNote ? (
          <div className="fixed inset-x-0 top-20 z-50 mx-auto w-[min(100%-1.5rem,24rem)] rounded-2xl border border-cyan-400/35 bg-[#0d1520]/95 px-4 py-3 text-center text-sm font-semibold text-cyan-50 shadow-lg backdrop-blur-md">
            {recoverNote}
          </div>
        ) : null}

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
                  onRecover={recoverAsset}
                  referralCode={user?.referralCode}
                  selected={selectedVideoIds.has(item.id)}
                  onToggleSelect={() => toggleVideoSelection(item.id)}
                />
              );
            })}
          </div>
        )}

        {!error && videos.length > 0 && viewMode === "grid" && (
          <div className="h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-y-contain px-1.5 pb-4 pt-28 sm:px-3 sm:pt-32">
            <div
              className="mx-auto grid max-w-6xl gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${gridZoom}, minmax(0, 1fr))`,
              }}
            >
              {videos.map((item) => (
                <GridVideoTile
                  key={item.id}
                  item={item}
                  onOpen={openVideoInBrowse}
                  selected={selectedVideoIds.has(item.id)}
                  onToggleSelect={() => toggleVideoSelection(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {selectionCount > 0 ? (
          <div
            className="pointer-events-auto fixed inset-x-0 bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-[125] mx-auto max-w-lg px-3"
            dir={dir}
          >
            <div className="flex flex-col gap-2 rounded-2xl border border-[#22f0ff]/30 bg-[#0d1118]/95 p-3 shadow-xl backdrop-blur-md sm:flex-row sm:items-center">
              <p className="flex-1 text-center text-sm font-semibold text-white sm:text-start">
                {t.assets.selectedCount.replace("{n}", String(selectionCount))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearVideoSelection}
                  className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-semibold text-white/70 sm:flex-none"
                >
                  {t.assets.clearSelection}
                </button>
                <button
                  type="button"
                  onClick={sendSelectedVideosToStudio}
                  className="flex-1 rounded-xl bg-[linear-gradient(135deg,#22f0ff,#7c5cff)] px-4 py-2.5 text-xs font-bold text-[#0b0d12] sm:flex-none"
                >
                  {t.assets.sendToStudio}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => {
          void logout().then(() => {
            setAssets([]);
            clearAssetsCache();
          });
        }}
      />
      <main className="mx-auto max-w-6xl px-4 pb-bottom-nav pt-6 sm:px-6" dir={dir}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Assets</h1>
            <p className="mt-1 text-sm text-white/50">
              {locale === "en" ? "Your saved images" : "صورك المحفوظة"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("video")}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80"
            >
              {t.assets.video}
            </button>
            <button
              type="button"
              onClick={() => setFilter("image")}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black"
            >
              {t.assets.photos}
            </button>
            <Link
              href="/edit"
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80"
            >
              {t.editStudio.tab}
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#141821] p-6 text-sm text-white/70">
            {error}
          </div>
        )}

        {!error && loading && images.length === 0 && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#22f0ff]" />
          </div>
        )}

        {!error && !loading && images.length === 0 && (
          <p className="mt-8 text-sm text-white/45">لا توجد صور بعد.</p>
        )}

        <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {images.map((item) => (
            <ImageTile
              key={item.id}
              item={item}
              onDeleted={(id) => {
                setAssets((prev) => {
                  const next = prev.filter((a) => a.id !== id);
                  writeAssetsCache(next);
                  return next;
                });
              }}
            />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
