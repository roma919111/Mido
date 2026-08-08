import type { MovieCategoryId } from "../lib/movie-categories";
import { MOVIE_CATEGORIES, categoryTitle } from "../lib/movie-categories";

type MoviesCategorySidebarProps = {
  active: MovieCategoryId;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: MovieCategoryId) => void;
};

export function MoviesCategorySidebar({
  active,
  search,
  onSearch,
  onSelect,
}: MoviesCategorySidebarProps) {
  return (
    <aside className="mstv-cat-sidebar">
      <h2 className="mstv-cat-sidebar__heading">MOVIES</h2>

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
        className={`mstv-cat-sidebar__item ${active === "favorite" ? "mstv-cat-sidebar__item--active" : ""}`}
        onClick={() => onSelect("favorite")}
      >
        <span className="mstv-cat-sidebar__max-icon" aria-hidden="true">
          ▶
        </span>
        <span>FAVORITE</span>
      </button>

      <button
        type="button"
        className={`mstv-cat-sidebar__item ${active === "recent" ? "mstv-cat-sidebar__item--active" : ""}`}
        onClick={() => onSelect("recent")}
      >
        <span className="mstv-cat-sidebar__max-icon" aria-hidden="true">
          ▶
        </span>
        <span>RECENTLY VIEWED</span>
      </button>

      <ul className="mstv-cat-sidebar__list">
        {MOVIE_CATEGORIES.map((cat) => (
          <li key={cat.id}>
            <button
              type="button"
              className={`mstv-cat-sidebar__cat ${active === cat.id ? "mstv-cat-sidebar__cat--active" : ""}`}
              onClick={() => onSelect(cat.id)}
            >
              <span className="mstv-cat-sidebar__clapper" aria-hidden="true">
                🎬
              </span>
              <span>
                {cat.label} - {cat.labelAr}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function moviesTopTitle(active: MovieCategoryId): string {
  return categoryTitle(active);
}
