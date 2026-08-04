import { useEffect, useState } from "react";
import type { CatalogItem, LaunchState } from "../types";
import { isInMyList, toggleMyList } from "../lib/library";
import { launchOnPlatform } from "../lib/playback";
import { PLATFORMS } from "../lib/platforms";

type DetailSheetProps = {
  item: CatalogItem | null;
  onClose: () => void;
  onLaunching: (state: LaunchState) => void;
};

export function DetailSheet({ item, onClose, onLaunching }: DetailSheetProps) {
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
            <p className="detail-sheet__platforms-label">متاح على</p>
            {item.platforms.map((link) => {
              const meta = PLATFORMS[link.platform];
              return (
                <button
                  key={link.platform}
                  type="button"
                  className="platform-play-btn"
                  style={{ "--platform-color": meta.color } as React.CSSProperties}
                  onClick={() => launchOnPlatform(item, link.platform, link.url, onLaunching)}
                >
                  <span className="platform-play-btn__icon">▶</span>
                  <span>
                    <strong>تشغيل على {meta.name}</strong>
                    <small>يفتح التطبيق أو الموقع الرسمي</small>
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
