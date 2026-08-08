import type { PlatformId } from "../types";
import { PLATFORMS } from "../lib/platforms";
import type { TmdbDiscoverItem } from "../lib/tmdb-discover";

type TmdbDiscoverRowProps = {
  title: string;
  items: TmdbDiscoverItem[];
  platform: PlatformId;
  onPlay: (item: TmdbDiscoverItem) => void;
  busy?: boolean;
};

export function TmdbDiscoverRow({ title, items, platform, onPlay, busy }: TmdbDiscoverRowProps) {
  if (!items.length) return null;
  const meta = PLATFORMS[platform];

  return (
    <section className="max-show__ott-row">
      <h2 className="max-show__ott-row-title">{title}</h2>
      <div className="max-show__ott-track">
        {items.map((item) => (
          <button
            key={`${item.tmdbType}-${item.tmdbId}`}
            type="button"
            className="max-show__ott-card"
            disabled={busy}
            onClick={() => onPlay(item)}
          >
            <div
              className="max-show__ott-poster"
              style={{ "--ott-color": meta.color } as React.CSSProperties}
            >
              <img src={item.posterUrl} alt="" className="max-show__ott-poster-img" loading="lazy" />
              <span className="max-show__ott-poster-badge">{meta.name}</span>
              {item.rating ? (
                <span className="max-show__ott-poster-rating">★ {item.rating.toFixed(1)}</span>
              ) : null}
              <span className="max-show__ott-poster-play">▶</span>
            </div>
            <p className="max-show__ott-card-title">{item.title}</p>
            {item.year ? <p className="max-show__ott-card-meta">{item.year}</p> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
