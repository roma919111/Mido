export type MovieCategoryId =
  | "favorite"
  | "recent"
  | "english-2026"
  | "english-2025"
  | "english-2324"
  | "netflix"
  | "action"
  | "country";

export type MovieCategory = {
  id: MovieCategoryId;
  label: string;
  labelAr: string;
  icon?: string;
};

export const MOVIE_CATEGORIES: MovieCategory[] = [
  { id: "english-2026", label: "ENGLISH MOVIES 2026", labelAr: "إنجليزي", icon: "🎬" },
  { id: "english-2025", label: "ENGLISH MOVIES 2025", labelAr: "إنجليزي", icon: "🎬" },
  { id: "english-2324", label: "ENGLISH MOVIES 23/24", labelAr: "إنجليزي", icon: "🎬" },
  { id: "netflix", label: "NETFLIX MOVIES", labelAr: "نتفلكس", icon: "🎬" },
  { id: "action", label: "ACTION MOVIES", labelAr: "أكشن", icon: "🎬" },
  { id: "country", label: "COUNTRY MOVIES", labelAr: "كانتري", icon: "🎬" },
];

export type MainNavId = "live" | "movies" | "series" | "favorites";

export const MAIN_NAV: { id: MainNavId; label: string; icon: string }[] = [
  { id: "live", label: "Live", icon: "📺" },
  { id: "movies", label: "Movies", icon: "🎬" },
  { id: "series", label: "Series", icon: "🎞️" },
  { id: "favorites", label: "Favorites", icon: "❤️" },
];

export function categoryTitle(id: MovieCategoryId): string {
  if (id === "favorite") return "FAVORITE";
  if (id === "recent") return "RECENTLY VIEWED";
  const cat = MOVIE_CATEGORIES.find((c) => c.id === id);
  return cat ? `${cat.label} - ${cat.labelAr}` : "MOVIES";
}
