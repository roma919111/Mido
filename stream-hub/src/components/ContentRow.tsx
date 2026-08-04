import type { CatalogItem } from "../types";
import { PosterCard } from "./PosterCard";

type ContentRowProps = {
  title: string;
  items: CatalogItem[];
  onSelect: (item: CatalogItem) => void;
  onPlay?: (item: CatalogItem, fromElement: HTMLElement) => void;
  wideFirst?: boolean;
};

export function ContentRow({ title, items, onSelect, onPlay, wideFirst }: ContentRowProps) {
  if (!items.length) return null;

  return (
    <section className="content-row">
      <h2 className="content-row__title">{title}</h2>
      <div className="content-row__track">
        {items.map((item, index) => (
          <PosterCard
            key={item.id}
            item={item}
            wide={wideFirst && index === 0}
            onSelect={onSelect}
            onPlay={onPlay}
          />
        ))}
      </div>
    </section>
  );
}
