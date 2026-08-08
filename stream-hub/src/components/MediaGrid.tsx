import type { TmdbDiscoverItem } from "../lib/tmdb-discover";
import { MediaGridCard } from "./MediaGridCard";

type MediaGridProps = {
  items: TmdbDiscoverItem[];
  onPlay: (item: TmdbDiscoverItem) => void;
  empty?: string;
};

export function MediaGrid({ items, onPlay, empty }: MediaGridProps) {
  if (!items.length) {
    return empty ? <p className="mstv-empty">{empty}</p> : null;
  }

  return (
    <div className="mstv-grid">
      {items.map((item) => (
        <MediaGridCard
          key={`${item.tmdbType}-${item.tmdbId}`}
          item={item}
          onPlay={onPlay}
        />
      ))}
    </div>
  );
}
