import type { IptvChannel } from "@/lib/iptv-client";

type IptvChannelRowProps = {
  title: string;
  items: IptvChannel[];
  onPlay: (ch: IptvChannel) => void;
};

export function IptvChannelRow({ title, items, onPlay }: IptvChannelRowProps) {
  if (!items.length) return null;

  return (
    <section className="mstv-row-section">
      <h2 className="mstv-row-section__title">{title}</h2>
      <div className="mstv-row-section__track">
        {items.map((item) => (
          <button key={item.id} type="button" className="mstv-row-card" onClick={() => onPlay(item)}>
            <div className="mstv-row-card__poster">
              {item.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.logo} alt="" loading="lazy" decoding="async" />
              ) : (
                <div className="mstv-row-card__poster-fallback">TV</div>
              )}
              <div className="mstv-row-card__scrim" />
              <p className="mstv-row-card__title">{item.name}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
