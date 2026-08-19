import { IptvBrandMark } from "./IptvBrandMark";

export type IptvMainNav = "home" | "live" | "movies" | "series" | "favorites";

type IptvMaxSidebarProps = {
  active: IptvMainNav;
  onChange: (nav: IptvMainNav) => void;
};

const NAV: Array<{ id: IptvMainNav; label: string; icon: string }> = [
  { id: "home", label: "الرئيسية", icon: "🏠" },
  { id: "live", label: "مباشر", icon: "📺" },
  { id: "movies", label: "أفلام", icon: "🎬" },
  { id: "series", label: "مسلسلات", icon: "🎞️" },
  { id: "favorites", label: "مفضلة", icon: "❤️" },
];

export function IptvMaxSidebar({ active, onChange }: IptvMaxSidebarProps) {
  return (
    <aside className="mstv-rail">
      <IptvBrandMark />

      <nav className="mstv-rail__nav" aria-label="Main">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mstv-rail__btn ${active === item.id ? "mstv-rail__btn--active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <span className="mstv-rail__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
