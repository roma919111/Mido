import type { CatalogItem, PlatformId } from "../types";
import { IptvOttCatalogCard } from "./IptvOttCatalogCard";

type IptvOttCatalogRowProps = {
  title: string;
  items: CatalogItem[];
  platform: PlatformId;
  onPlay: (item: CatalogItem, platform: PlatformId) => void;
  busy?: boolean;
};

export function IptvOttCatalogRow({ title, items, platform, onPlay, busy }: IptvOttCatalogRowProps) {
  if (!items.length) return null;

  return (
    <section className="max-show__ott-row">
      <h2 className="max-show__ott-row-title">{title}</h2>
      <div className="max-show__ott-track">
        {items.map((item) => (
          <IptvOttCatalogCard
            key={item.id}
            item={item}
            platform={platform}
            onPlay={onPlay}
            busy={busy}
          />
        ))}
      </div>
    </section>
  );
}
