import type { CatalogItem } from "../types";

const CACHE_KEY = "max.tmdb.posters";

type PosterCache = Record<string, { posterUrl: string; rating?: number | null }>;

function cacheKey(item: CatalogItem): string {
  if (item.tmdbId && item.tmdbType) return `${item.tmdbType}:${item.tmdbId}`;
  return `q:${item.titleEn ?? item.title}`;
}

function readCache(): PosterCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as PosterCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: PosterCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

function apiBase(): string {
  const iptv = import.meta.env.VITE_IPTV_API?.trim();
  if (iptv?.startsWith("http")) {
    return iptv.replace(/\/iptv\/?$/, "/tmdb/poster");
  }
  if (import.meta.env.DEV || iptv) return "/api/max/tmdb/poster";
  return "";
}

export type TmdbPoster = {
  posterUrl: string;
  rating: number | null;
};

export async function fetchTmdbPoster(item: CatalogItem): Promise<TmdbPoster | null> {
  const key = cacheKey(item);
  const cached = readCache()[key];
  if (cached) {
    return { posterUrl: cached.posterUrl, rating: cached.rating ?? null };
  }

  const base = apiBase();
  if (!base) return null;

  const params = new URLSearchParams();
  if (item.tmdbId && item.tmdbType) {
    params.set("id", String(item.tmdbId));
    params.set("type", item.tmdbType);
  } else if (item.titleEn || item.title) {
    params.set("query", item.titleEn ?? item.title);
  } else {
    return null;
  }

  try {
    const res = await fetch(`${base}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { posterUrl?: string; rating?: number | null };
    if (!data.posterUrl) return null;

    const result = { posterUrl: data.posterUrl, rating: data.rating ?? null };
    const all = readCache();
    all[key] = result;
    writeCache(all);
    return result;
  } catch {
    return null;
  }
}
