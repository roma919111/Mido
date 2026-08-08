import type { TmdbDiscoverItem } from "../lib/tmdb-discover";

type MediaRowCardProps = {
  item: TmdbDiscoverItem;
  onPlay: (item: TmdbDiscoverItem) => void;
};

export function MediaRowCard({ item, onPlay }: MediaRowCardProps) {
  const rating = item.rating ? item.rating.toFixed(1) : null;

  return (
    <button type="button" className="mstv-row-card" onClick={() => onPlay(item)}>
      <div className="mstv-row-card__poster">
        <img src={item.posterUrl} alt="" loading="lazy" />
        {rating ? <span className="mstv-row-card__rating">★ {rating}</span> : null}
        <div className="mstv-row-card__scrim" />
        <p className="mstv-row-card__title">
          {item.title}
          {item.year ? ` (${item.year})` : ""}
        </p>
      </div>
    </button>
  );
}

type MediaRowSectionProps = {
  title: string;
  items: TmdbDiscoverItem[];
  onPlay: (item: TmdbDiscoverItem) => void;
};

export function MediaRowSection({ title, items, onPlay }: MediaRowSectionProps) {
  if (!items.length) return null;

  return (
    <section className="mstv-row-section">
      <h2 className="mstv-row-section__title">{title}</h2>
      <div className="mstv-row-section__track">
        {items.map((item) => (
          <MediaRowCard key={`${item.tmdbType}-${item.tmdbId}`} item={item} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}
