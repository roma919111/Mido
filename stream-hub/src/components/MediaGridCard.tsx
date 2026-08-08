import type { TmdbDiscoverItem } from "../lib/tmdb-discover";

type MediaGridCardProps = {
  item: TmdbDiscoverItem;
  onPlay: (item: TmdbDiscoverItem) => void;
};

export function MediaGridCard({ item, onPlay }: MediaGridCardProps) {
  const rating = item.rating ? item.rating.toFixed(1) : null;

  return (
    <button type="button" className="mstv-grid-card" onClick={() => onPlay(item)}>
      <div className="mstv-grid-card__poster">
        <img src={item.posterUrl} alt="" loading="lazy" />
        {rating ? <span className="mstv-grid-card__rating">★ {rating}</span> : null}
        <div className="mstv-grid-card__scrim" />
        <p className="mstv-grid-card__title">
          {item.title}
          {item.year ? ` (${item.year})` : ""}
        </p>
      </div>
    </button>
  );
}
