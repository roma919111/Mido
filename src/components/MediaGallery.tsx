"use client";

import { Check, Copy, Download, Film, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toPlaybackUrl } from "@/lib/media-proxy";
import type { GalleryItem } from "@/lib/types";

interface MediaGalleryProps {
  items: GalleryItem[];
}

export function MediaGallery({ items }: MediaGalleryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playbackErrors, setPlaybackErrors] = useState<Record<string, string>>({});
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setPlaybackErrors({});
    setRetryCounts({});
  }, [items]);

  const copyPrompt = async (item: GalleryItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
            Media Gallery
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Recently generated images and videos from your VYRONIX.AI session.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-white/30">{items.length} items</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
            <Film className="h-5 w-5 text-white/40" />
          </div>
          <p className="text-white/70">No generations yet</p>
          <p className="mt-1 text-sm text-white/40">
            Create an image or video and it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <article
              key={item.id}
              className="animate-fade-up overflow-hidden rounded-3xl border border-white/8 bg-[rgba(14,16,22,0.85)]"
              style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
            >
              <div className="relative aspect-video bg-black/40">
                {item.status !== "completed" || !item.url ? (
                  <div className="flex h-full items-center justify-center text-sm text-white/50">
                    {item.status === "failed" ? item.error ?? "Failed" : "Processing…"}
                  </div>
                ) : item.mediaType === "video" ? (
                  playbackErrors[item.id] ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/55">
                      <p>تعذّر تشغيل الفيديو.</p>
                      <p className="text-xs text-white/35">{playbackErrors[item.id]}</p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--accent)] underline"
                      >
                        فتح الفيديو في تبويب جديد
                      </a>
                    </div>
                  ) : (
                    <video
                      key={`${item.id}-${retryCounts[item.id] ?? 0}`}
                      src={toPlaybackUrl(item.url, "video")}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                      onError={() => {
                        const retries = retryCounts[item.id] ?? 0;
                        if (retries < 4) {
                          window.setTimeout(() => {
                            setRetryCounts((prev) => ({
                              ...prev,
                              [item.id]: retries + 1,
                            }));
                          }, (retries + 1) * 2500);
                          return;
                        }

                        setPlaybackErrors((prev) => ({
                          ...prev,
                          [item.id]:
                            "الملف غير جاهز بعد أو تعذّر تحميله. انتظر قليلاً ثم أعد التوليد إن لزم.",
                        }));
                      }}
                    />
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.prompt}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/35">
                  {item.mediaType === "video" ? (
                    <Film className="h-3.5 w-3.5" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  {item.mode}
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed text-white/75">{item.prompt}</p>

                <div className="flex items-center gap-2">
                  <a
                    href={item.url || undefined}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 ${
                      !item.url ? "pointer-events-none opacity-40" : ""
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyPrompt(item)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
                  >
                    {copiedId === item.id ? (
                      <Check className="h-4 w-4 text-[var(--accent)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedId === item.id ? "Copied" : "Copy Prompt"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
