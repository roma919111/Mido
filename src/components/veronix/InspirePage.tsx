"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Copy,
  Film,
  Loader2,
  Search,
  Sparkles,
  Star,
  Tv,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { fetchJson } from "@/lib/fetch-json";
import { buildInspirePrompt, createInspireHref } from "@/lib/inspire-prompts";
import {
  INSPIRE_GENRES,
  inspirePosterUrl,
  type InspireGenre,
  type InspireItem,
  type InspireTab,
} from "@/lib/inspire-types";

const GENRE_GRADIENT: Record<InspireGenre, string> = {
  action: "from-orange-600/80 to-red-950",
  drama: "from-blue-700/80 to-slate-950",
  "sci-fi": "from-cyan-600/80 to-indigo-950",
  horror: "from-red-900/80 to-black",
  comedy: "from-amber-500/80 to-orange-950",
  romance: "from-pink-600/80 to-purple-950",
  thriller: "from-zinc-600/80 to-black",
  fantasy: "from-violet-600/80 to-fuchsia-950",
  animation: "from-teal-500/80 to-blue-950",
  crime: "from-stone-600/80 to-neutral-950",
};

function tabMatches(item: InspireItem, tab: InspireTab): boolean {
  if (tab === "all") return true;
  if (tab === "trending") return item.trending;
  if (tab === "movie") return item.mediaType === "movie";
  return item.mediaType === "tv";
}

function InspirePoster({ item }: { item: InspireItem }) {
  const [failed, setFailed] = useState(false);
  const poster = inspirePosterUrl(item.posterPath);
  const gradient = GENRE_GRADIENT[item.genres[0] || "drama"];

  if (poster && !failed) {
    return (
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}
    >
      {item.mediaType === "movie" ? (
        <Film className="h-10 w-10 text-white/35" aria-hidden />
      ) : (
        <Tv className="h-10 w-10 text-white/35" aria-hidden />
      )}
    </div>
  );
}

export function InspirePage() {
  const { t, dir, locale } = useLocale();
  const { user, refreshUser, logout, ready, refreshing } = useCustomerUser();

  const [items, setItems] = useState<InspireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<InspireTab>("trending");
  const [genre, setGenre] = useState<InspireGenre | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InspireItem | null>(null);
  const [copied, setCopied] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{ items?: InspireItem[] }>(
        "/api/inspire/trending",
      );
      if (!res.ok) throw new Error(t.inspire.error);
      setItems(data.items || []);
    } catch {
      setError(t.inspire.error);
    } finally {
      setLoading(false);
    }
  }, [t.inspire.error]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!selected) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!tabMatches(item, tab)) return false;
      if (genre !== "all" && !item.genres.includes(genre)) return false;
      if (!q) return true;
      const title = item.title[locale].toLowerCase();
      const alt = item.title[locale === "ar" ? "en" : "ar"].toLowerCase();
      const overview = item.overview[locale].toLowerCase();
      return title.includes(q) || alt.includes(q) || overview.includes(q);
    });
  }, [items, tab, genre, search, locale]);

  const selectedPrompt = selected ? buildInspirePrompt(selected, locale) : "";

  async function copyPrompt() {
    if (!selectedPrompt) return;
    try {
      await navigator.clipboard.writeText(selectedPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const tabs: { id: InspireTab; label: string }[] = [
    { id: "trending", label: t.inspire.tabTrending },
    { id: "movie", label: t.inspire.tabMovies },
    { id: "tv", label: t.inspire.tabSeries },
    { id: "all", label: t.inspire.tabAll },
  ];

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => void logout()}
      />

      <main className="mx-auto max-w-5xl px-4 pb-bottom-nav pt-8 sm:px-6" dir={dir}>
        <p className="text-xs uppercase tracking-[0.2em] text-[#22f0ff]/80">
          {t.inspire.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{t.inspire.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
          {t.inspire.subtitle}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.inspire.searchPlaceholder}
              className="w-full rounded-2xl border border-white/10 bg-[#141821] py-3 pe-4 ps-10 text-sm text-white outline-none ring-[#22f0ff]/0 transition focus:border-[#22f0ff]/40 focus:ring-2 focus:ring-[#22f0ff]/20"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#141821] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-[#22f0ff]/30 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {t.inspire.refresh}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={t.inspire.tabList}>
          {tabs.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-black"
                    : "border border-white/10 text-white/70 hover:border-white/25 hover:text-white"
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setGenre("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              genre === "all"
                ? "bg-[#22f0ff]/15 text-[#22f0ff]"
                : "border border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {t.inspire.allGenres}
          </button>
          {INSPIRE_GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                genre === g
                  ? "bg-[#22f0ff]/15 text-[#22f0ff]"
                  : "border border-white/10 text-white/60 hover:text-white"
              }`}
            >
              {t.inspire.genres[g]}
            </button>
          ))}
        </div>

        {loading && !items.length ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-white/5 bg-[#141821] p-3"
              >
                <div className="aspect-[2/3] rounded-xl bg-white/5" />
                <div className="mt-3 h-4 w-2/3 rounded bg-white/5" />
                <div className="mt-2 h-3 w-1/3 rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-6 text-sm text-red-200">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#141821] px-4 py-10 text-center text-sm text-white/50">
            {t.inspire.empty}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const title = item.title[locale];
              const overview = item.overview[locale];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setCopied(false);
                  }}
                  className="group rounded-2xl border border-white/10 bg-[#141821] p-3 text-start transition hover:border-[#22f0ff]/30 hover:bg-[#171b24]"
                >
                  <InspirePoster item={item} />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
                      <p className="mt-0.5 text-xs text-white/45">
                        {item.mediaType === "movie" ? t.inspire.movie : t.inspire.series} ·{" "}
                        {item.year}
                      </p>
                    </div>
                    {item.rating ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                        <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden />
                        {item.rating}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.genres.slice(0, 2).map((g) => (
                      <span
                        key={g}
                        className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-white/55"
                      >
                        {t.inspire.genres[g]}
                      </span>
                    ))}
                    {item.trending ? (
                      <span className="rounded-md bg-[#22f0ff]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#22f0ff]">
                        {t.inspire.trendingBadge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/45">
                    {overview}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#22f0ff]/80">
                    {t.inspire.usePrompt} →
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-[10px] text-white/30">{t.inspire.tmdbNote}</p>
      </main>

      <BottomNav />

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#141821] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspire-detail-title"
          >
            <div className="relative p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white/70 hover:text-white"
                aria-label={t.inspire.close}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>

              <div className="flex gap-4">
                <div className="w-28 shrink-0 sm:w-32">
                  <InspirePoster item={selected} />
                </div>
                <div className="min-w-0 flex-1 pe-8">
                  <p className="text-[10px] uppercase tracking-wider text-[#22f0ff]/80">
                    {selected.mediaType === "movie" ? t.inspire.movie : t.inspire.series}
                  </p>
                  <h2
                    id="inspire-detail-title"
                    className="mt-1 font-display text-xl font-bold leading-tight"
                  >
                    {selected.title[locale]}
                  </h2>
                  <p className="mt-1 text-sm text-white/45">{selected.year}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white/70"
                      >
                        {t.inspire.genres[g]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/60">
                {selected.overview[locale]}
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {t.inspire.promptLabel}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{selectedPrompt}</p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={createInspireHref(selectedPrompt)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-3 text-sm font-bold text-black transition hover:opacity-90"
                >
                  <Clapperboard className="h-4 w-4" aria-hidden />
                  {t.inspire.createCta}
                </Link>
                <button
                  type="button"
                  onClick={() => void copyPrompt()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/30"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  {copied ? t.inspire.copied : t.inspire.copyPrompt}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
