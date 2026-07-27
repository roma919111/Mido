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
import { Download, Loader2, Pencil, Volume2, VolumeX } from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearEtaStart,
  estimateGenerateSeconds,
  formatStudioCountdownLabel,
  inferTargetSecondsFromAsset,
  lockEtaStart,
  remainingGenerateSeconds,
} from "@/lib/generate-eta";
import { writeEditDraft } from "@/lib/edit-draft";
import {
  cleanAssetPrompt,
  assetPromptTitle,
  veronixDownloadPath,
  veronixMediaSrc,
  veronixPosterSrc,
} from "@/lib/media-proxy";
import type { VisualReference } from "@/lib/types";

interface AssetItem {
  id: string;
  mediaType: "image" | "video";
  url: string;
  prompt: string;
  mode?: string;
  model: string;
  creditsUsed: number;
  status: string;
  createdAt: string;
  historyId?: string;
  error?: string;
  targetSeconds?: number;
}

function RunningCountdown({
  assetId,
  createdAt,
  targetSeconds,
}: {
  assetId: string;
  createdAt: string;
  targetSeconds: number;
}) {
  const [remaining, setRemaining] = useState(() => {
    const started = lockEtaStart(assetId, createdAt);
    return remainingGenerateSeconds(started, targetSeconds);
  });
  const [overdue, setOverdue] = useState(0);

  useEffect(() => {
    const started = lockEtaStart(assetId, createdAt);
    const eta = estimateGenerateSeconds(targetSeconds);
    const tick = () => {
      const rem = remainingGenerateSeconds(started, targetSeconds);
      setRemaining(rem);
      const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setOverdue(Math.max(0, elapsed - eta));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [assetId, createdAt, targetSeconds]);

  return (
    <span className="max-w-[16rem] text-center text-sm font-bold tabular-nums text-[#22f0ff] sm:text-base">
      {formatStudioCountdownLabel({
        remainingSec: remaining,
        targetSeconds,
        overdueForSec: overdue,
      })}
    </span>
  );
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
  muted,
  onToggleMute,
}: {
  item: AssetItem;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const src = veronixMediaSrc({
    historyId: item.historyId,
    url: item.url,
    mediaType: "video",
  });
  const poster = veronixPosterSrc({
    historyId: item.historyId,
    url: item.url,
  });
  const prompt = cleanAssetPrompt(item.prompt);
  const title = assetPromptTitle(item.prompt);
  const promptLong = prompt.length > 110;
  const canPlay =
    Boolean(src) &&
    item.status !== "failed" &&
    item.status !== "running";

  useEffect(() => {
    setPromptExpanded(false);
  }, [item.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !canPlay) return;
    el.muted = muted;
    if (active) {
      const play = el.play();
      if (play && typeof play.catch === "function") {
        play.catch(() => undefined);
      }
    } else {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, [active, muted, canPlay, src]);

  const handleEdit = async () => {
    if (editing) return;
    setEditing(true);
    try {
      const el = videoRef.current;
      let startFrame: VisualReference | null = null;
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
          startFrame = await captureVideoFrame(el);
        } catch {
          startFrame = null;
        }
      }
      // Poster fallback when frame capture is blocked (CORS / not ready).
      if (!startFrame && poster && !posterFailed) {
        startFrame = {
          type: "image",
          id: `edit-poster-${item.id}`,
          url: poster,
          label: "edit-start-frame",
        };
      }
      writeEditDraft({
        prompt: prompt || item.prompt || "",
        media: "video",
        startFrame,
        sourceAssetId: item.id,
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

  return (
    <section
      data-asset-id={item.id}
      className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
    >
      {canPlay ? (
        <>
          {poster && !posterFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity ${
                active ? "opacity-0" : "opacity-100"
              }`}
              onError={() => setPosterFailed(true)}
            />
          ) : null}
          <video
            ref={videoRef}
            src={active ? src || undefined : undefined}
            poster={!posterFailed && poster ? poster : undefined}
            playsInline
            loop
            muted={muted}
            preload={active ? "auto" : "none"}
            controls={false}
            controlsList="nodownload"
            className={`absolute inset-0 h-full w-full object-contain ${
              active ? "opacity-100" : "opacity-0"
            }`}
          />
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
                ? "فشل التوليد"
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
        </div>
      )}

      {/* Soft bottom gradient for prompt readability */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {/* Edit / mute / download — above prompt overlay so taps always work */}
      <div className="absolute bottom-36 left-3 z-40 flex flex-col items-center gap-3 sm:bottom-40 sm:left-5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleEdit();
          }}
          disabled={editing || item.status !== "completed"}
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        {(item.url || item.historyId) && item.status === "completed" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDownload();
            }}
            disabled={downloading}
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md disabled:opacity-50"
            aria-label="تحميل"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Title + truncated description with «عرض المزيد» */}
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
            <p className="mt-1 text-xs text-rose-300">{item.error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ImageTile({ item }: { item: AssetItem }) {
  const router = useRouter();
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
          <img src={src} alt="" className="h-full w-full object-cover" />
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
        <button
          type="button"
          onClick={() => {
            writeEditDraft({
              prompt: prompt || item.prompt || "",
              media: "image",
              startFrame: src
                ? {
                    type: "image",
                    id: `edit-img-${item.id}`,
                    url: src,
                    label: "edit-image",
                  }
                : null,
              sourceAssetId: item.id,
            });
            router.push("/create/video?edit=1");
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22f0ff]"
        >
          <Pencil className="h-3.5 w-3.5" />
          تعديل
        </button>
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
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"video" | "image">("video");
  const [muted, setMuted] = useState(true);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const loadAssets = useCallback(async () => {
    const me = await fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
    setUser(me.data.user);
    if (!me.data.user) {
      setError("سجّل الدخول لعرض ملفاتك.");
      return;
    }
    const { res, data } = await fetchJson<{ assets?: AssetItem[]; error?: string }>(
      "/api/assets",
    );
    if (!res.ok) {
      setError(data.error || "Failed to load assets");
      return;
    }
    setError(null);
    const next = (data.assets || []).filter((a) => a.mode !== "sequence-part");
    setAssets(next);
    for (const a of next) {
      if (a.status === "completed" || a.status === "failed") {
        clearEtaStart(a.id);
      }
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const hasRunning = assets.some((a) => a.status === "running");
    if (!hasRunning || !user) return;
    const t = window.setInterval(() => {
      void loadAssets();
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
                });
              }}
            />
          </div>
          <div className="pointer-events-auto flex items-center justify-between px-4 pb-3" dir="rtl">
            <div>
              <p className="font-display text-lg font-extrabold">Assets</p>
              <p className="text-[11px] text-white/45">اسحب للأعلى مثل تيك توك</p>
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

        {!error && videos.length === 0 && (
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
            {videos.map((item) => (
              <FeedVideoSlide
                key={item.id}
                item={item}
                active={activeId === item.id}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
              />
            ))}
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

        {!error && images.length === 0 && (
          <p className="mt-8 text-sm text-white/45">لا توجد صور بعد.</p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((item) => (
            <ImageTile key={item.id} item={item} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
