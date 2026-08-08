import { useEffect, useState } from "react";
import { fetchTmdbByCategory, type TmdbDiscoverItem } from "../lib/tmdb-discover";
import { useLockedPlay } from "../hooks/useLockedPlay";
import { MediaRowSection } from "./MediaRowSection";

export function MaxShowSeriesView() {
  const [series, setSeries] = useState<TmdbDiscoverItem[]>([]);
  const { play } = useLockedPlay("netflix");

  useEffect(() => {
    void fetchTmdbByCategory("latest-series", "netflix").then(setSeries);
  }, []);

  return (
    <div className="mstv-browse">
      <MediaRowSection title="Latest Series" items={series} onPlay={(item) => void play(item)} />
    </div>
  );
}
