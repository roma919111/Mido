import {
  ALL_MODELS,
  type CatalogModel,
} from "@/lib/model-catalog";

/** Models shown in the bottom nav logo strip — available first, then coming soon. */
export function bottomNavModels(): CatalogModel[] {
  const sorted = [...ALL_MODELS].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === "video" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

export function createHrefForModel(model: CatalogModel): string {
  const base = model.kind === "image" ? "/create/image" : "/create/video";
  return `${base}?model=${encodeURIComponent(model.id)}`;
}
