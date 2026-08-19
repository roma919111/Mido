"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { userInitials } from "@/lib/avatar-url";
import { publicFeedVideoSrc } from "@/lib/edit-studio-publish";
import { fetchJson } from "@/lib/fetch-json";

type FeedItem = {
  id: string;
  prompt: string;
  aspectRatio: string;
  publishedAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

function FeedCard({ item }: { item: FeedItem }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const avatarSrc =
    item.authorAvatarUrl?.startsWith("http") ? item.authorAvatarUrl : null;
  const aspect = item.aspectRatio === "9:16" ? "9/16" : "16/9";

  return (
    <article className="w-[min(72vw,14rem)] shrink-0 snap-start sm:w-56">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-black ring-1 ring-white/5"
        style={{ aspectRatio: aspect }}
      >
        <video
          ref={videoRef}
          src={publicFeedVideoSrc(item.id)}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {!playing ? (
          <button
            type="button"
            aria-label="Play"
            onClick={() => void videoRef.current?.play()}
            className="absolute inset-0 flex items-center justify-center bg-black/25 transition hover:bg-black/35"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#0b0d12] shadow-lg">
              ▶
            </span>
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15" />
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#22f0ff]/15 text-[10px] font-bold text-[#22f0ff]">
            {userInitials(item.authorName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{item.authorName}</p>
          <p className="line-clamp-2 text-[11px] leading-snug text-white/45">{item.prompt}</p>
        </div>
      </div>
    </article>
  );
}

export function HomeCommunityFeed() {
  const { t, dir } = useLocale();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { res, data } = await fetchJson<{ items?: FeedItem[] }>("/api/feed?limit=12");
        if (res.ok && Array.isArray(data.items)) setItems(data.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <section className="border-b border-white/8 py-8" dir={dir}>
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 text-sm text-white/45 sm:px-6">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t.home.feedLoading}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="border-b border-white/8 py-8" dir={dir}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#22f0ff]/10 text-[#22f0ff] ring-1 ring-[#22f0ff]/25">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[#22f0ff]/90">
              {t.home.feedEyebrow}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">{t.home.feedTitle}</h2>
            <p className="mt-1 text-sm text-white/50">{t.home.feedSub}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
