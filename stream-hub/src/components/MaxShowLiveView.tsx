import { useEffect, useState } from "react";
import { fetchTmdbByCategory, type TmdbDiscoverItem } from "../lib/tmdb-discover";
import { useLockedPlay } from "../hooks/useLockedPlay";
import { MediaRowSection } from "./MediaRowSection";

/** Image 2 — Latest Movies + Latest Series rows */
export function MaxShowLiveView() {
  const [movies, setMovies] = useState<TmdbDiscoverItem[]>([]);
  const [series, setSeries] = useState<TmdbDiscoverItem[]>([]);
  const { play } = useLockedPlay("netflix");

  useEffect(() => {
    void fetchTmdbByCategory("latest-movies", "netflix").then(setMovies);
    void fetchTmdbByCategory("latest-series", "netflix").then(setSeries);
  }, []);

  return (
    <div className="mstv-browse">
      <MediaRowSection title="Latest Movies" items={movies} onPlay={(item) => void play(item)} />
      <MediaRowSection title="Latest Series" items={series} onPlay={(item) => void play(item)} />
    </div>
  );
}
