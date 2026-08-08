import { MAIN_NAV, type MainNavId } from "../lib/movie-categories";

type MaxShowSidebarProps = {
  active: MainNavId;
  onChange: (nav: MainNavId) => void;
};

export function MaxShowSidebar({ active, onChange }: MaxShowSidebarProps) {
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
        {MAIN_NAV.map((item) => (
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
