import { useEffect, useState } from "react";
import { getFavoriteItems, type TmdbDiscoverItem } from "../lib/tmdb-discover";
import { useLockedPlay } from "../hooks/useLockedPlay";
import { MediaGrid } from "./MediaGrid";

export function MaxShowFavoritesView() {
  const [items, setItems] = useState<TmdbDiscoverItem[]>([]);
  const { play } = useLockedPlay("netflix");

  useEffect(() => {
    setItems(getFavoriteItems());
  }, []);

  return (
    <div className="mstv-favorites">
      <header className="mstv-topbar mstv-topbar--simple">
        <h1 className="mstv-topbar__title">Favorites</h1>
      </header>
      <MediaGrid
        items={items}
        onPlay={(item) => void play(item)}
        empty="No favorites"
      />
    </div>
  );
}
