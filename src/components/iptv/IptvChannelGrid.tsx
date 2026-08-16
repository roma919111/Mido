import type { IptvChannel } from "@/lib/iptv-client";

type IptvChannelGridProps = {
  items: IptvChannel[];
  onPlay: (ch: IptvChannel) => void;
  empty?: string;
};

export function IptvChannelGrid({ items, onPlay, empty }: IptvChannelGridProps) {
  if (!items.length) {
    return empty ? <p className="mstv-empty">{empty}</p> : null;
  }

  return (
    <div className="mstv-grid">
      {items.map((item) => (
        <button key={item.id} type="button" className="mstv-grid-card" onClick={() => onPlay(item)}>
          <div className="mstv-grid-card__poster">
            {item.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.logo} alt="" loading="lazy" decoding="async" />
            ) : (
              <div className="mstv-grid-card__poster-fallback">TV</div>
            )}
            <div className="mstv-grid-card__scrim" />
            <p className="mstv-grid-card__title">{item.name}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
