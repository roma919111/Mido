import { useEffect, useMemo, useState } from "react";
import type { MovieCategoryId } from "../lib/movie-categories";
import {
  fetchTmdbByCategory,
  getFavoriteItems,
  getRecentItems,
  type TmdbDiscoverItem,
} from "../lib/tmdb-discover";
import { useLockedPlay } from "../hooks/useLockedPlay";
import { MediaGrid } from "./MediaGrid";
import { MoviesCategorySidebar, moviesTopTitle } from "./MoviesCategorySidebar";

export function MaxShowMoviesView() {
  const [category, setCategory] = useState<MovieCategoryId>("english-2026");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"default" | "rating">("default");
  const [items, setItems] = useState<TmdbDiscoverItem[]>([]);
  const [localItems, setLocalItems] = useState<TmdbDiscoverItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { play } = useLockedPlay("netflix");

  useEffect(() => {
    if (category === "favorite") {
      setLocalItems(getFavoriteItems());
      setItems([]);
      return;
    }
    if (category === "recent") {
      setLocalItems(getRecentItems());
      setItems([]);
      return;
    }

    setLoading(true);
    setLocalItems([]);
    const platform = category === "netflix" ? "netflix" : "netflix";
    void fetchTmdbByCategory(category, platform).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [category]);

  const displayItems = useMemo(() => {
    const base = category === "favorite" || category === "recent" ? localItems : items;
    const q = search.trim().toLowerCase();
    let list = q ? base.filter((i) => i.title.toLowerCase().includes(q)) : base;
    if (sort === "rating") {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return list;
  }, [category, items, localItems, search, sort]);

  return (
    <div className="mstv-movies-layout">
      <MoviesCategorySidebar
        active={category}
        search={search}
        onSearch={setSearch}
        onSelect={setCategory}
      />

      <div className="mstv-movies-main">
        <header className="mstv-topbar">
          <h1 className="mstv-topbar__title">{moviesTopTitle(category)}</h1>
          <button
            type="button"
            className="mstv-topbar__sort"
            onClick={() => setSort((s) => (s === "default" ? "rating" : "default"))}
          >
            <span aria-hidden="true">☰</span> {sort === "default" ? "Default" : "Rating"}
          </button>
        </header>

        {loading ? <p className="mstv-empty">Loading…</p> : null}

        <MediaGrid
          items={displayItems}
          onPlay={(item) => void play(item)}
          empty={
            category === "favorite"
              ? "No favorites yet"
              : "No results — add TMDB_API_KEY on server"
          }
        />
      </div>
    </div>
  );
}
