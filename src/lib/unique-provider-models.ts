import type { CatalogModel } from "@/lib/model-catalog";
import { bottomNavModels } from "@/lib/bottom-nav-models";
import { modelProviderKey } from "@/lib/model-logos";

/** One representative model per provider logo — avoids duplicate marks in the strip. */
export function uniqueProviderModels(): CatalogModel[] {
  const models = bottomNavModels();
  const seen = new Set<string>();
  const result: CatalogModel[] = [];
  for (const model of models) {
    const key = modelProviderKey(model);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(model);
  }
  return result;
}
