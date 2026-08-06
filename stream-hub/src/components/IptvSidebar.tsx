import type { IptvNav } from "../lib/iptv-categories";
import { formatSubscriptionExpiry } from "../lib/iptv-client";

type IptvSidebarProps = {
  active: IptvNav;
  onChange: (nav: IptvNav) => void;
  onLogout: () => void;
  label: string | null;
  expiresAt: string | null;
};

const ITEMS: { id: IptvNav; label: string; icon: string }[] = [
  { id: "live", label: "Live", icon: "📺" },
  { id: "movies", label: "Movies", icon: "🎬" },
  { id: "series", label: "Series", icon: "🎞️" },
  { id: "favorites", label: "Favorites", icon: "❤️" },
  { id: "apps", label: "Apps", icon: "📲" },
];

export function IptvSidebar({ active, onChange, onLogout, label, expiresAt }: IptvSidebarProps) {
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
        {label ? <p className="max-show__subscription">{label}</p> : null}
        <p className="max-show__subscription-status">{formatSubscriptionExpiry(expiresAt)}</p>
      </div>

      <nav className="max-show__nav" aria-label="IPTV">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`max-show__nav-btn ${active === item.id ? "max-show__nav-btn--active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <span className="max-show__nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="max-show__logout" onClick={onLogout}>
        خروج
      </button>
    </aside>
  );
}
