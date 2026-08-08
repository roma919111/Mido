import type { PlatformId } from "../types";
import { CATALOG } from "../data/catalog";
import { normalizeDeepLink } from "./deeplink";

export type ResolvedPlatformLink = {
  url: string | null;
  searchQuery: string;
  direct: boolean;
};

export function findCatalogPlatformUrl(
  tmdbId: number,
  tmdbType: "movie" | "tv",
  platform: PlatformId,
): string | null {
  for (const item of CATALOG) {
    if (item.tmdbId !== tmdbId || item.tmdbType !== tmdbType) continue;
    const link = item.platforms?.find((p) => p.platform === platform);
    if (link?.url) return normalizeDeepLink(platform, link.url);
  }
  return null;
}

export function buildSearchQuery(title: string, year: string | null): string {
  const base = title.trim();
  if (year && !base.includes(year)) return `${base} ${year}`;
  return base;
}

/** Instant resolve — no network (keeps Android user-gesture for native launch). */
export function resolvePlatformDeepLinkSync(
  tmdbId: number,
  tmdbType: "movie" | "tv",
  platform: PlatformId,
  title: string,
  year: string | null,
): ResolvedPlatformLink {
  const local = findCatalogPlatformUrl(tmdbId, tmdbType, platform);
  const searchQuery = buildSearchQuery(title, year);
  if (local) return { url: local, searchQuery, direct: true };
  return { url: null, searchQuery, direct: false };
}

function apiBase(): string {
  const iptv = import.meta.env.VITE_IPTV_API?.trim();
  if (iptv?.startsWith("http")) {
    return iptv.replace(/\/iptv\/?$/, "/tmdb");
  }
  if (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true" || iptv) {
    return "/api/max/tmdb";
  }
  return "";
}

/** Resolve TMDB item → direct platform URL or in-app search query. */
export async function resolvePlatformDeepLink(
  tmdbId: number,
  tmdbType: "movie" | "tv",
  platform: PlatformId,
  title: string,
  year: string | null,
): Promise<ResolvedPlatformLink> {
  const local = findCatalogPlatformUrl(tmdbId, tmdbType, platform);
  if (local) {
    return { url: local, searchQuery: buildSearchQuery(title, year), direct: true };
  }

  const base = apiBase();
  if (base) {
    try {
      const params = new URLSearchParams({
        id: String(tmdbId),
        type: tmdbType,
        platform,
        title,
      });
      if (year) params.set("year", year);
      const res = await fetch(`${base}/deeplink?${params}`);
      if (res.ok) {
        const data = (await res.json()) as {
          url?: string | null;
          searchQuery?: string;
          direct?: boolean;
        };
        if (data.url) {
          return {
            url: normalizeDeepLink(platform, data.url),
            searchQuery: data.searchQuery ?? buildSearchQuery(title, year),
            direct: true,
          };
        }
        if (data.searchQuery) {
          return { url: null, searchQuery: data.searchQuery, direct: false };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return { url: null, searchQuery: buildSearchQuery(title, year), direct: false };
}
