import type { PlatformId } from "../types";
import type { MovieCategoryId } from "./movie-categories";
import { enrichDiscoverPlatforms } from "./tmdb-watch-providers";
import type { TmdbDiscoverItem } from "./tmdb-discover";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

const WATCH_PROVIDERS: Partial<Record<string, number>> = {
  netflix: 8,
  shahid: 1718,
};

type DiscoverParams = {
  mediaType: "movie" | "tv";
  year?: number;
  yearGte?: number;
  yearLte?: number;
  genre?: number;
  language?: string;
  provider?: string;
};

const CATEGORY_MAP: Record<string, DiscoverParams> = {
  "english-2026": { mediaType: "movie", year: 2026, language: "en" },
  "english-2025": { mediaType: "movie", year: 2025, language: "en" },
  "english-2324": { mediaType: "movie", yearGte: 2023, yearLte: 2024, language: "en" },
  netflix: { mediaType: "movie", provider: "netflix" },
  action: { mediaType: "movie", genre: 28 },
  country: { mediaType: "movie", genre: 18 },
  "latest-movies": { mediaType: "movie" },
  "latest-series": { mediaType: "tv" },
  live: { mediaType: "movie", genre: 99 },
};

export function tmdbApiKey(): string | null {
  const key = import.meta.env.VITE_TMDB_API_KEY?.trim();
  return key || null;
}

export function hasDirectTmdb(): boolean {
  return Boolean(tmdbApiKey());
}

export async function fetchTmdbByCategoryDirect(
  category: MovieCategoryId | "latest-movies" | "latest-series" | "live",
  platform: PlatformId = "netflix",
  region = "SA",
): Promise<TmdbDiscoverItem[]> {
  const apiKey = tmdbApiKey();
  if (!apiKey) return [];

  const cfg = CATEGORY_MAP[category] ?? {
    mediaType: "movie" as const,
    provider: WATCH_PROVIDERS[platform] ? platform : undefined,
  };
  const discoverUrl = new URL(`https://api.themoviedb.org/3/discover/${cfg.mediaType}`);
  discoverUrl.searchParams.set("api_key", apiKey);
  discoverUrl.searchParams.set("sort_by", "popularity.desc");
  discoverUrl.searchParams.set("language", "en-US");
  discoverUrl.searchParams.set("page", "1");

  if (cfg.year) {
    const key = cfg.mediaType === "movie" ? "primary_release_year" : "first_air_date_year";
    discoverUrl.searchParams.set(key, String(cfg.year));
  }
  if (cfg.yearGte) {
    const key = cfg.mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
    discoverUrl.searchParams.set(key, `${cfg.yearGte}-01-01`);
  }
  if (cfg.yearLte) {
    const key = cfg.mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
    discoverUrl.searchParams.set(key, `${cfg.yearLte}-12-31`);
  }
  if (cfg.language) {
    discoverUrl.searchParams.set("with_original_language", cfg.language);
  }
  if (cfg.genre) {
    discoverUrl.searchParams.set("with_genres", String(cfg.genre));
  }
  if (cfg.provider && WATCH_PROVIDERS[cfg.provider]) {
    discoverUrl.searchParams.set("watch_region", region);
    discoverUrl.searchParams.set("with_watch_providers", String(WATCH_PROVIDERS[cfg.provider]));
  }

  try {
    const res = await fetch(discoverUrl.toString());
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: {
        id: number;
        title?: string;
        name?: string;
        poster_path?: string | null;
        vote_average?: number;
        release_date?: string;
        first_air_date?: string;
        original_language?: string;
      }[];
    };

    const rawItems = (data.results ?? [])
      .filter((r) => r.poster_path)
      .slice(0, 40);

    const originalLanguages = new Map<string, string | null>();
    for (const r of rawItems) {
      originalLanguages.set(`${cfg.mediaType}:${r.id}`, r.original_language ?? null);
    }

    const baseItems = rawItems.map((r) => ({
      tmdbId: r.id,
      tmdbType: cfg.mediaType,
      title: r.title ?? r.name ?? "—",
      posterUrl: `${TMDB_IMAGE}${r.poster_path}`,
      rating: r.vote_average ?? null,
      year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4) || null,
    }));

    if (cfg.provider && WATCH_PROVIDERS[cfg.provider]) {
      return baseItems.map((item) => ({ ...item, platform: cfg.provider as PlatformId }));
    }

    return enrichDiscoverPlatforms(apiKey, baseItems, {
      region,
      preferred: platform,
      originalLanguages,
    });
  } catch {
    return [];
  }
}
