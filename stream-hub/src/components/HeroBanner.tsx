import type { CatalogItem } from "../types";

type HeroBannerProps = {
  item: CatalogItem;
  onPlay: (item: CatalogItem) => void;
  onDetails: (item: CatalogItem) => void;
};

export function HeroBanner({ item, onPlay, onDetails }: HeroBannerProps) {
  return (
    <section className="hero" style={{ background: item.posterGradient }}>
      <div className="hero__scrim" />
      <div className="hero__content">
        {item.rating ? <span className="hero__pill">{item.rating}</span> : null}
        <h1 className="hero__title">{item.title}</h1>
        {item.titleEn ? <p className="hero__subtitle">{item.titleEn}</p> : null}
        <p className="hero__synopsis">{item.synopsis}</p>
        <div className="hero__actions">
          <button type="button" className="btn btn--primary" onClick={() => onPlay(item)}>
            ▶ تشغيل
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onDetails(item)}>
            ℹ المزيد
          </button>
        </div>
      </div>
    </section>
  );
}
