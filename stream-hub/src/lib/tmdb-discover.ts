import type { PlatformId } from "../types";
import type { MovieCategoryId } from "./movie-categories";
import { fetchTmdbByCategoryDirect, hasDirectTmdb } from "./tmdb-direct";

export type TmdbDiscoverItem = {
  tmdbId: number;
  tmdbType: "movie" | "tv";
  title: string;
  posterUrl: string;
  rating: number | null;
  year: string | null;
};

function apiBase(): string {
  const iptv = import.meta.env.VITE_IPTV_API?.trim();
  if (iptv?.startsWith("http")) {
    return iptv.replace(/\/iptv\/?$/, "/tmdb");
  }
  if (import.meta.env.DEV || iptv) return "/api/max/tmdb";
  return "";
}

export async function fetchTmdbByCategory(
  category: MovieCategoryId | "latest-movies" | "latest-series" | "live",
  platform: PlatformId = "netflix",
): Promise<TmdbDiscoverItem[]> {
  if (hasDirectTmdb()) {
    return fetchTmdbByCategoryDirect(category, platform);
  }

  const base = apiBase();
  if (!base) return [];

  try {
    const params = new URLSearchParams({ category, platform });
    const res = await fetch(`${base}/discover?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TmdbDiscoverItem[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

export function platformSearchUrl(platform: PlatformId, title: string): string {
  const q = encodeURIComponent(title);
  switch (platform) {
    case "netflix":
      return `https://www.netflix.com/search?q=${q}`;
    case "shahid":
      return `https://shahid.mbc.net/ar/search?q=${q}`;
    case "tod":
      return `https://www.tod.tv/ar/search?q=${q}`;
  }
}

const FAV_KEY = "max.show.favorites";
const RECENT_KEY = "max.show.recent";

export function getFavoriteItems(): TmdbDiscoverItem[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as TmdbDiscoverItem[]) : [];
  } catch {
    return [];
  }
}

export function getRecentItems(): TmdbDiscoverItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as TmdbDiscoverItem[]) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteItem(item: TmdbDiscoverItem): boolean {
  const list = getFavoriteItems();
  const idx = list.findIndex((x) => x.tmdbId === item.tmdbId && x.tmdbType === item.tmdbType);
  if (idx >= 0) {
    list.splice(idx, 1);
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
    return false;
  }
  list.unshift(item);
  localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 100)));
  return true;
}

export function pushRecentItem(item: TmdbDiscoverItem): void {
  const list = getRecentItems().filter(
    (x) => !(x.tmdbId === item.tmdbId && x.tmdbType === item.tmdbType),
  );
  list.unshift(item);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 50)));
}

export function isFavoriteItem(item: TmdbDiscoverItem): boolean {
  return getFavoriteItems().some(
    (x) => x.tmdbId === item.tmdbId && x.tmdbType === item.tmdbType,
  );
}
