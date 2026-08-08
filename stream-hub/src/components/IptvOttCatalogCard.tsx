import type { CatalogItem, PlatformId } from "../types";
import { useTmdbPoster } from "../hooks/useTmdbPoster";
import { PLATFORMS } from "../lib/platforms";

type IptvOttCatalogCardProps = {
  item: CatalogItem;
  platform: PlatformId;
  onPlay: (item: CatalogItem, platform: PlatformId) => void;
  busy?: boolean;
};

export function IptvOttCatalogCard({ item, platform, onPlay, busy }: IptvOttCatalogCardProps) {
  const meta = PLATFORMS[platform];
  const { posterUrl, rating } = useTmdbPoster(item);
  const displayRating = rating ? rating.toFixed(1) : item.rating;

  return (
    <button
      type="button"
      className="max-show__ott-card"
      disabled={busy}
      onClick={() => onPlay(item, platform)}
    >
      <div
        className="max-show__ott-poster"
        style={{ background: item.posterGradient, "--ott-color": meta.color } as React.CSSProperties}
      >
        {posterUrl ? (
          <img src={posterUrl} alt="" className="max-show__ott-poster-img" loading="lazy" />
        ) : null}
        <span className="max-show__ott-poster-badge">{meta.name}</span>
        {displayRating ? (
          <span className="max-show__ott-poster-rating">
            {rating ? `★ ${displayRating}` : displayRating}
          </span>
        ) : null}
        <span className="max-show__ott-poster-play">▶</span>
      </div>
      <p className="max-show__ott-card-title">{item.title}</p>
      {item.year ? <p className="max-show__ott-card-meta">{item.year}</p> : null}
    </button>
  );
}
