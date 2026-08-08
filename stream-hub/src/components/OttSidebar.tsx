import type { PlatformId } from "../types";
import { PLATFORMS } from "../lib/platforms";

type OttSidebarProps = {
  active: PlatformId;
  onChange: (platform: PlatformId) => void;
};

const ITEMS: { id: PlatformId; label: string; icon: string }[] = [
  { id: "netflix", label: "Netflix", icon: "N" },
  { id: "shahid", label: "Shahid", icon: "ش" },
  { id: "tod", label: "TOD", icon: "T" },
];

export function OttSidebar({ active, onChange }: OttSidebarProps) {
  return (
    <aside className="max-show__sidebar">
      <div className="max-show__logo-wrap">
        <div className="max-show__logo" aria-hidden="true">
          <span className="max-show__logo-play">▶</span>
        </div>
        <div className="max-show__brand">
          <strong>MAX</strong>
          <span>SHOW TV</span>
        </div>
        <p className="max-show__subscription">Netflix · Shahid · TOD</p>
        <p className="max-show__subscription-status">TMDB + deeplink</p>
      </div>

      <nav className="max-show__nav" aria-label="منصات رسمية">
        {ITEMS.map((item) => {
          const meta = PLATFORMS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className={`max-show__nav-btn ${active === item.id ? "max-show__nav-btn--active" : ""}`}
              style={
                active === item.id
                  ? ({ "--nav-accent": meta.color } as React.CSSProperties)
                  : undefined
              }
              onClick={() => onChange(item.id)}
            >
              <span
                className="max-show__nav-icon max-show__nav-icon--brand"
                style={{ color: meta.color }}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <p className="max-show__sidebar-note">▶ deeplink · ← MAX للرجوع</p>
    </aside>
  );
}
