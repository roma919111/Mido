import { CATALOG } from "../data/catalog";
import type { CatalogItem, PlatformId } from "../types";

export function catalogForPlatform(platform: PlatformId): CatalogItem[] {
  return CATALOG.filter((item) => item.platforms.some((link) => link.platform === platform));
}

export function platformUrl(item: CatalogItem, platform: PlatformId): string | null {
  return item.platforms.find((link) => link.platform === platform)?.url ?? null;
}

export const OTT_ROW_FILTERS: { id: string; title: string; match: (item: CatalogItem) => boolean }[] = [
  { id: "featured", title: "مميز لك", match: (item) => Boolean(item.featured) },
  { id: "series", title: "مسلسلات", match: (item) => item.category === "series" },
  { id: "movies", title: "أفلام", match: (item) => item.category === "movie" },
  { id: "sport", title: "رياضة", match: (item) => item.category === "sport" },
  { id: "kids", title: "عائلي", match: (item) => item.category === "kids" },
];

export function ottRowsForPlatform(platform: PlatformId) {
  const items = catalogForPlatform(platform);
  return OTT_ROW_FILTERS.map((row) => ({
    id: `${platform}-${row.id}`,
    title: row.title,
    items: items.filter(row.match),
  })).filter((row) => row.items.length > 0);
}
