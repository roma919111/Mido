export type InspireMediaType = "movie" | "tv";

export type InspireGenre =
  | "action"
  | "drama"
  | "sci-fi"
  | "horror"
  | "comedy"
  | "romance"
  | "thriller"
  | "fantasy"
  | "animation"
  | "crime";

export type InspireItem = {
  id: string;
  mediaType: InspireMediaType;
  title: { ar: string; en: string };
  year: number;
  genres: InspireGenre[];
  overview: { ar: string; en: string };
  posterPath: string | null;
  /** TMDB numeric id — used when TMDB_API_KEY is set. */
  tmdbId?: number;
  /** English Wikipedia page title for poster lookup. */
  wikiTitle?: string;
  trending: boolean;
  rating?: number;
};

export type InspireTab = "all" | "trending" | "movie" | "tv";

export const INSPIRE_GENRES: InspireGenre[] = [
  "action",
  "drama",
  "sci-fi",
  "horror",
  "comedy",
  "romance",
  "thriller",
  "fantasy",
  "animation",
  "crime",
];

export function inspirePosterUrl(posterPath: string | null | undefined): string | null {
  if (!posterPath) return null;
  if (posterPath.startsWith("http")) return posterPath;
  return `https://image.tmdb.org/t/p/w342${posterPath}`;
}
