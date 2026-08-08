import { useEffect, useState } from "react";
import type { CatalogItem } from "../types";
import { fetchTmdbPoster } from "../lib/tmdb-client";

export function useTmdbPoster(item: CatalogItem) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTmdbPoster(item).then((data) => {
      if (cancelled || !data) return;
      setPosterUrl(data.posterUrl);
      setRating(data.rating);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.tmdbId, item.tmdbType, item.titleEn, item.title]);

  return { posterUrl, rating };
}
