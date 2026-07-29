"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, Pencil, Play, Trash2, Volume2, VolumeX } from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearEtaStart,
  inferTargetSecondsFromAsset,
  lockEtaStart,
} from "@/lib/generate-eta";
import { writeEditDraft } from "@/lib/edit-draft";
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

type AssetItem = CachedAssetItem;

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** Only attach video src after Play — neighbors stay on poster (CDN bytes). */
  const [armed, setArmed] = useState(false);

  const mediaUrl = veronixMediaSrc({
    historyId: item.historyId,
    url: item.url,
    mediaType: "video",
  });
  const src = loadMedia && armed ? mediaUrl : null;
  // Prefer URL-based posters (CDN) — skip BytePlus history lookup on cold open.
  const poster =
    loadMedia
      ? veronixPosterSrc({
          url: item.url,
          historyId: item.historyId,
        })
      : null;
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
    setPlaying(false);
    setArmed(false);
  }, [item.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !canPlay) return;
    el.muted = muted;
    // Normal media player: never autoplay. Pause + unload when leaving the slide.
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
  }, [active, muted, canPlay]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el || !canPlay || !mediaUrl) return;
    if (!armed) {
      setArmed(true);
      // src attaches on next paint — play from effect below
      return;
    }
    if (el.paused) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  useEffect(() => {
    if (!armed || !active || !canPlay) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => undefined);
  }, [armed, active, canPlay, src]);

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

      writeEditDraft({
        prompt: prompt || item.prompt || "",
        media: "video",
        startFrame: null,
        referenceImages: characters,
        sourceAssetId: item.id,
        duration: inferTargetSecondsFromAsset(item),
        resolution: item.resolution,
        aspectRatio: item.aspectRatio,
        preferClarity: item.preferClarity,
      });
      router.push("/create/video?edit=1");
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
    const ok = window.confirm("حذف هذا الفيديو من Assets؟");
    if (!ok) return;
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
      className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
    >
      {canPlay ? (
        <>
          {/* Poster always for active+neighbors; video bytes only after Play. */}
          {!armed && poster && !posterFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-contain bg-black"
              onError={() => setPosterFailed(true)}
            />
          ) : null}
          <video
            ref={videoRef}
            src={src || undefined}
            poster={!posterFailed && poster ? poster : undefined}
            playsInline
            loop
            muted={muted}
            preload={armed && active ? "auto" : "none"}
            controls={false}
            controlsList="nodownload"
            onClick={togglePlay}
            onPlaying={() => {
              setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onError={() => {
              setPosterFailed(true);
              setPlaying(false);
            }}
            className="absolute inset-0 h-full w-full object-contain bg-black"
          />

          {/* Center Play — hidden while watching (tap video to pause). */}
          {!playing ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="absolute inset-0 z-30 flex items-center justify-center"
              aria-label="تشغيل"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition active:scale-95">
                <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
              </span>
            </button>
          ) : null}
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
              ? "جاري التوليد"
              : item.status === "failed"
                ? item.error?.includes("تم استرجاع")
                  ? "فشل التوليد · تم استرجاع الكريديت"
                  : "فشل التوليد"
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
          {item.status === "failed" && item.error?.includes("تم استرجاع") ? (
            <p className="relative z-10 mt-1 max-w-xs text-xs text-emerald-200/90">
              أُعيد الكريديت إلى رصيدك
            </p>
          ) : null}
        </div>
      )}

      {/* Soft bottom gradient for prompt readability */}
      {!playing ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      ) : null}

      {/* Side actions — hidden while watching */}
      {!playing ? (
      <div className="absolute bottom-48 left-3 z-40 flex flex-col items-center gap-2.5 sm:bottom-52 sm:left-5">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleEdit();
            }}
            disabled={editing || item.status === "running"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur-md disabled:opacity-40"
            aria-label="تعديل"
          >
            {editing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Pencil className="h-5 w-5" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">تعديل</span>
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
            aria-label="حذف"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">حذف</span>
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
            aria-label="تحميل"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-white/80">تحميل</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      ) : null}

      {/* Title + truncated description — hidden while watching */}
      {!playing ? (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-20 px-4 pb-[env(safe-area-inset-bottom)] pl-20 sm:px-6 sm:pl-24"
        dir="rtl"
      >
        <div className="pointer-events-auto max-w-[min(100%,28rem)]">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#22f0ff]/90">
            تم إنشاؤه بواسطة VYRONIX
          </p>
          <h2 className="text-base font-extrabold leading-snug text-white sm:text-lg">
            {title}
          </h2>
          {prompt ? (
            <div className="mt-1.5">
              <p
                className={`text-sm leading-relaxed text-white/80 sm:text-[15px] ${
                  promptExpanded ? "" : "line-clamp-2"
                }`}
              >
                {prompt}
              </p>
              {promptLong ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPromptExpanded((v) => !v);
                  }}
                  className="mt-1 text-xs font-semibold text-white/95 underline-offset-2 hover:underline"
                >
                  {promptExpanded ? "عرض أقل" : "عرض المزيد"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-white/50">بدون وصف</p>
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
                  aspectRatio: item.aspectRatio,
                  resolution: item.resolution,
                });
                router.push("/create/image?edit=1");
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
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>(() => readAssetsCache() || []);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"video" | "image">("video");
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(() => !readAssetsCache()?.length);
  const feedRef = useRef<HTMLDivElement | null>(null);

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
    let cancelled = false;
    void (async () => {
      const cached = readAssetsCache();
      if (cached?.length) {
        setAssets(cached);
        setLoading(false);
      }

      // Auth + fast library in parallel so Assets paints immediately.
      const mePromise = fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
      const listPromise = loadAssets();
      const me = await mePromise;
      if (cancelled) return;
      setUser(me.data.user);
      if (!me.data.user) {
        clearAssetsCache();
        setAssets([]);
        setError("سجّل الدخول لعرض ملفاتك.");
        setLoading(false);
        return;
      }
      await listPromise;
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
  }, [loadAssets]);

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
  const activeId = useActiveSlide(feedRef, videos.length);

  if (filter === "video") {
    return (
      <div className="relative min-h-[100dvh] bg-black text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent">
          <div className="pointer-events-auto">
            <AppHeader
              user={user}
              onLogout={() => {
                void fetch("/api/auth/customer/logout", { method: "POST" }).then(() => {
                  setUser(null);
                  setAssets([]);
                  clearAssetsCache();
                });
              }}
            />
          </div>
          <div className="pointer-events-auto flex items-center justify-between px-4 pb-3" dir="rtl">
            <div>
              <p className="font-display text-lg font-extrabold">Assets</p>
              <p className="text-[11px] text-white/45">اسحب للأعلى</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("video")}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black"
              >
                فيديو
              </button>
              <button
                type="button"
                onClick={() => setFilter("image")}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80"
              >
                صور
              </button>
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

        {!error && videos.length > 0 && (
          <div
            ref={feedRef}
            className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
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

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        onLogout={() => {
          void fetch("/api/auth/customer/logout", { method: "POST" }).then(() => {
            setUser(null);
            setAssets([]);
            clearAssetsCache();
          });
        }}
      />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Assets</h1>
            <p className="mt-1 text-sm text-white/50">صورك المحفوظة</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("video")}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80"
            >
              فيديو
            </button>
            <button
              type="button"
              onClick={() => setFilter("image")}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black"
            >
              صور
            </button>
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
