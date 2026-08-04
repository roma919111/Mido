import type { CatalogItem } from "../types";
import { PLATFORMS } from "../lib/platforms";

type PosterCardProps = {
  item: CatalogItem;
  wide?: boolean;
  onSelect: (item: CatalogItem) => void;
};

export function PosterCard({ item, wide, onSelect }: PosterCardProps) {
  const primaryPlatform = item.platforms[0]?.platform;
  const badge = primaryPlatform ? PLATFORMS[primaryPlatform].name : null;

  return (
    <button
      type="button"
      className={`poster-card ${wide ? "poster-card--wide" : ""}`}
      onClick={() => onSelect(item)}
      aria-label={item.title}
    >
      <div className="poster-card__art" style={{ background: item.posterGradient }}>
        {badge ? <span className="poster-card__badge">{badge}</span> : null}
        <div className="poster-card__fade" />
        <p className="poster-card__title">{item.title}</p>
      </div>
    </button>
  );
}
