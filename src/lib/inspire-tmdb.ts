import type { InspireGenre, InspireItem } from "@/lib/inspire-types";
import { inspirePosterUrl } from "@/lib/inspire-types";

const TMDB_BASE = "https://api.themoviedb.org/3";

const GENRE_MAP: Record<number, InspireGenre> = {
  28: "action",
  12: "action",
  16: "animation",
  35: "comedy",
  80: "crime",
  99: "drama",
  18: "drama",
  10751: "fantasy",
  14: "fantasy",
  27: "horror",
  10749: "romance",
  878: "sci-fi",
  53: "thriller",
  9648: "thriller",
};

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  media_type?: "movie" | "tv";
};

function mapGenres(ids: number[] | undefined): InspireGenre[] {
  if (!ids?.length) return ["drama"];
  const out = new Set<InspireGenre>();
  for (const id of ids) {
    const hit = GENRE_MAP[id];
    if (hit) out.add(hit);
  }
  return out.size ? [...out] : ["drama"];
}

function yearFromDate(value: string | undefined): number {
  const y = value?.slice(0, 4);
  const n = Number(y);
  return Number.isFinite(n) && n > 1900 ? n : new Date().getFullYear();
}

function mapTmdbItem(row: TmdbResult, mediaType: "movie" | "tv"): InspireItem {
  const title = row.title || row.name || "Untitled";
  const overview = row.overview?.trim() || "";
  return {
    id: `${mediaType}-tmdb-${row.id}`,
    mediaType,
    tmdbId: row.id,
    title: { ar: title, en: title },
    year: yearFromDate(row.release_date || row.first_air_date),
    genres: mapGenres(row.genre_ids),
    overview: { ar: overview, en: overview },
    posterPath: inspirePosterUrl(row.poster_path || null),
    trending: true,
    rating: row.vote_average ? Math.round(row.vote_average * 10) / 10 : undefined,
  };
}

async function tmdbFetch<T>(path: string, apiKey: string): Promise<T | null> {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}&language=en-US`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchTmdbTrending(apiKey: string): Promise<InspireItem[]> {
  const [movies, series, all] = await Promise.all([
    tmdbFetch<{ results?: TmdbResult[] }>("/trending/movie/day", apiKey),
    tmdbFetch<{ results?: TmdbResult[] }>("/trending/tv/day", apiKey),
    tmdbFetch<{ results?: TmdbResult[] }>("/trending/all/day", apiKey),
  ]);

  const out: InspireItem[] = [];
  const seen = new Set<number>();

  for (const row of all?.results || []) {
    const type = row.media_type === "tv" ? "tv" : row.media_type === "movie" ? "movie" : null;
    if (!type || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(mapTmdbItem(row, type));
  }

  for (const row of movies?.results || []) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(mapTmdbItem(row, "movie"));
  }

  for (const row of series?.results || []) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(mapTmdbItem(row, "tv"));
  }

  return out.slice(0, 40);
}
