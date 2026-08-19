"use client";

import { useEffect, useMemo, useRef } from "react";
import type { IptvCategory, IptvChannel } from "@/lib/iptv-client";
import { sortLiveCategoriesForUi } from "@/lib/iptv-live-default";

export type IptvGuideVariant = "live" | "movie" | "series";

type IptvLiveGuideProps = {
  variant?: IptvGuideVariant;
  categories: IptvCategory[];
  categoryId: string;
  channels: IptvChannel[];
  total: number;
  search: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error?: string | null;
  deviceLabel?: string;
  onSearch: (q: string) => void;
  onSelectCategory: (id: string) => void;
  onPlay: (ch: IptvChannel) => void;
  onLoadMore: () => void;
  onLogout: () => void;
};

const COPY: Record<
  IptvGuideVariant,
  {
    heading: string;
    all: string;
    searchPlaceholder: string;
    unit: string;
    loading: string;
    empty: string;
    more: string;
    fallbackTitle: string;
  }
> = {
  live: {
    heading: "القنوات المباشرة",
    all: "كل القنوات",
    searchPlaceholder: "ابحث عن قناة…",
    unit: "قناة",
    loading: "جاري تحميل القنوات…",
    empty: "لا توجد قنوات في هذه الباقة",
    more: "مرّر لعرض باقي القنوات",
    fallbackTitle: "القنوات المباشرة",
  },
  movie: {
    heading: "الأفلام",
    all: "كل الأفلام",
    searchPlaceholder: "ابحث عن فيلم…",
    unit: "فيلم",
    loading: "جاري تحميل الأفلام…",
    empty: "لا توجد أفلام في هذه الباقة",
    more: "مرّر لعرض باقي الأفلام",
    fallbackTitle: "الأفلام",
  },
  series: {
    heading: "المسلسلات",
    all: "كل المسلسلات",
    searchPlaceholder: "ابحث عن مسلسل…",
    unit: "مسلسل",
    loading: "جاري تحميل المسلسلات…",
    empty: "لا توجد مسلسلات في هذه الباقة",
    more: "مرّر لعرض باقي المسلسلات",
    fallbackTitle: "المسلسلات",
  },
};

export function IptvLiveGuide({
  variant = "live",
  categories,
  categoryId,
  channels,
  total,
  search,
  loading,
  loadingMore,
  hasMore,
  error,
  deviceLabel,
  onSearch,
  onSelectCategory,
  onPlay,
  onLoadMore,
  onLogout,
}: IptvLiveGuideProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const copy = COPY[variant];
  const activeCategory = categories.find((cat) => cat.id === categoryId);
  const title =
    categoryId === "favorite"
      ? "المفضلة"
      : categoryId === "recent"
        ? "شوهدت مؤخراً"
        : categoryId === "all"
          ? copy.all
          : activeCategory?.name ?? copy.fallbackTitle;

  const sortedCategories = useMemo(
    () => (variant === "live" ? sortLiveCategoriesForUi(categories) : categories),
    [categories, variant],
  );

  const options = useMemo(
    () => [
      { id: "favorite", name: "المفضلة" },
      { id: "recent", name: "شوهدت مؤخراً" },
      ...sortedCategories.map((cat) => ({
        id: cat.id,
        name: cat.count > 0 ? `${cat.name} (${cat.count.toLocaleString("ar")})` : cat.name,
      })),
      { id: "all", name: copy.all },
    ],
    [copy.all, sortedCategories],
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore, channels.length]);

  return (
    <div className="mstv-guide">
      <header className="mstv-topbar mstv-topbar--simple">
        <h1 className="mstv-topbar__title">{copy.heading}</h1>
        <button type="button" className="mstv-topbar__sort" onClick={onLogout}>
          خروج · {deviceLabel}
        </button>
      </header>

      <div className="mstv-guide__toolbar">
        <label className="mstv-guide__select">
          <span>الباقة</span>
          <select value={categoryId} onChange={(e) => onSelectCategory(e.target.value)}>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mstv-guide__search">
          <span>بحث</span>
          <input
            type="search"
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
      </div>

      <div className="mstv-guide__meta">
        <h2>{title}</h2>
        <p>
          {loading && !channels.length
            ? "جاري التحميل…"
            : `${channels.length.toLocaleString("ar")}${total ? ` / ${total.toLocaleString("ar")}` : ""} ${copy.unit}`}
        </p>
      </div>

      {error ? <p className="iptv-error">{error}</p> : null}

      <ol className="mstv-guide__list">
        {channels.map((channel, index) => (
          <li key={channel.id}>
            <button type="button" className="mstv-guide__row" onClick={() => onPlay(channel)}>
              <span className="mstv-guide__num" dir="ltr">
                {String(index + 1).padStart(3, "0")}
              </span>
              <span className="mstv-guide__logo">
                {channel.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={channel.logo} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>TV</span>
                )}
              </span>
              <span className="mstv-guide__info">
                <strong>{channel.name}</strong>
                {channel.group ? <small>{channel.group}</small> : null}
              </span>
              <span className="mstv-guide__play" aria-hidden="true">
                ▶
              </span>
            </button>
          </li>
        ))}
      </ol>

      {loading && !channels.length ? <p className="mstv-empty">{copy.loading}</p> : null}
      {!loading && !channels.length ? <p className="mstv-empty">{copy.empty}</p> : null}
      {hasMore ? (
        <div ref={sentinelRef} className="mstv-guide__more">
          {loadingMore ? "جاري تحميل المزيد…" : copy.more}
        </div>
      ) : null}
    </div>
  );
}
