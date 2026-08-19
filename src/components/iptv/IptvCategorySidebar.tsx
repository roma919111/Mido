import type { IptvCategory } from "@/lib/iptv-client";

type IptvCategorySidebarProps = {
  heading: string;
  categories: IptvCategory[];
  active: string;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onFavorite: () => void;
  onRecent: () => void;
  favoriteActive: boolean;
  recentActive: boolean;
};

export function IptvCategorySidebar({
  heading,
  categories,
  active,
  search,
  onSearch,
  onSelect,
  onFavorite,
  onRecent,
  favoriteActive,
  recentActive,
}: IptvCategorySidebarProps) {
  return (
    <aside className="mstv-cat-sidebar">
      <h2 className="mstv-cat-sidebar__heading">{heading}</h2>

      <label className="mstv-cat-sidebar__search">
        <span className="mstv-cat-sidebar__search-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          placeholder="Search.."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>

      <button
        type="button"
        className={`mstv-cat-sidebar__item ${favoriteActive ? "mstv-cat-sidebar__item--active" : ""}`}
        onClick={onFavorite}
      >
        <span className="mstv-cat-sidebar__max-icon" aria-hidden="true">
          ▶
        </span>
        <span>FAVORITE</span>
      </button>

      <button
        type="button"
        className={`mstv-cat-sidebar__item ${recentActive ? "mstv-cat-sidebar__item--active" : ""}`}
        onClick={onRecent}
      >
        <span className="mstv-cat-sidebar__max-icon" aria-hidden="true">
          ▶
        </span>
        <span>RECENTLY VIEWED</span>
      </button>

      <ul className="mstv-cat-sidebar__list">
        {categories.map((cat) => (
          <li key={cat.id}>
            <button
              type="button"
              className={`mstv-cat-sidebar__cat ${active === cat.id ? "mstv-cat-sidebar__cat--active" : ""}`}
              onClick={() => onSelect(cat.id)}
            >
              <span className="mstv-cat-sidebar__clapper" aria-hidden="true">
                📺
              </span>
              <span>
                {cat.name}
                {cat.count > 0 ? ` (${cat.count.toLocaleString("en")})` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
