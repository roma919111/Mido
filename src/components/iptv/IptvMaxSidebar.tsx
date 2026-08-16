type IptvMaxSidebarProps = {
  active: "live" | "channels" | "favorites";
  onChange: (nav: "live" | "channels" | "favorites") => void;
};

const NAV = [
  { id: "live" as const, label: "Live", icon: "📺" },
  { id: "channels" as const, label: "Channels", icon: "🎬" },
  { id: "favorites" as const, label: "Favorites", icon: "❤️" },
];

export function IptvMaxSidebar({ active, onChange }: IptvMaxSidebarProps) {
  return (
    <aside className="mstv-rail">
      <div className="mstv-rail__logo">
        <div className="mstv-rail__logo-circle" aria-hidden="true">
          <span>▶</span>
        </div>
        <div className="mstv-rail__brand">
          <strong>MAX</strong>
          <span>SHOW TV</span>
        </div>
      </div>

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
