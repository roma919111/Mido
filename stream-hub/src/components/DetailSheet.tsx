import { useEffect, useState } from "react";
import type { CatalogItem, PlatformId } from "../types";
import { isInMyList, toggleMyList } from "../lib/library";
import { PLATFORMS } from "../lib/platforms";

type DetailSheetProps = {
  item: CatalogItem | null;
  onClose: () => void;
  onPlay: (item: CatalogItem, platform: PlatformId, url: string, fromElement: HTMLElement) => void;
};

export function DetailSheet({ item, onClose, onPlay }: DetailSheetProps) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    if (item) setInList(isInMyList(item.id));
  }, [item]);

  if (!item) return null;

  function handleMyList() {
    setInList(toggleMyList(item!.id));
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="detail-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        <div className="detail-sheet__hero" style={{ background: item.posterGradient }}>
          <button type="button" className="detail-sheet__close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div className="detail-sheet__body">
          <h2>{item.title}</h2>
          <p className="detail-sheet__meta">{item.description}</p>
          <p className="detail-sheet__synopsis">{item.synopsis}</p>

          {item.trailerYoutubeId ? (
            <div className="detail-sheet__trailer">
              <p className="detail-sheet__trailer-label">معاينة داخل التطبيق</p>
              <iframe
                title={`Trailer — ${item.title}`}
                src={`https://www.youtube-nocookie.com/embed/${item.trailerYoutubeId}?rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}

          <div className="detail-sheet__platforms">
            <p className="detail-sheet__platforms-label">متاح على — اضغط للتشغيل</p>
            {item.platforms.map((link) => {
              const meta = PLATFORMS[link.platform];
              return (
                <button
                  key={link.platform}
                  type="button"
                  className="platform-play-btn"
                  style={{ "--platform-color": meta.color } as React.CSSProperties}
                  onClick={(e) => onPlay(item, link.platform, link.url, e.currentTarget)}
                >
                  <span className="platform-play-btn__icon">▶</span>
                  <span>
                    <strong>تشغيل على {meta.name}</strong>
                    <small>رابط مباشر — يفتح صفحة التشغيل بسرعة</small>
                  </span>
                </button>
              );
            })}
          </div>

          <button type="button" className="btn btn--ghost btn--block" onClick={handleMyList}>
            {inList ? "✓ في قائمتي" : "+ أضف إلى قائمتي"}
          </button>
        </div>
      </div>
    </div>
  );
}
