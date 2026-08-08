import type { PlatformId } from "../types";

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

export async function fetchTmdbDiscover(
  platform: PlatformId,
  type: "movie" | "tv",
): Promise<TmdbDiscoverItem[]> {
  const base = apiBase();
  if (!base) return [];

  try {
    const params = new URLSearchParams({ platform, type });
    const res = await fetch(`${base}/discover?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TmdbDiscoverItem[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

/** Build a searchable deeplink when we don't have an exact title URL. */
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
