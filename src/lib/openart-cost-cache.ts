import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OPENART_COST_DEFAULTS,
  type CostCacheItem,
} from "@/lib/openart-cost-defaults";
import {
  lookupCostFromItems,
  type CostLookupResult,
  type CostLookupWanted,
} from "@/lib/openart-cost-lookup";

export type { CostLookupResult, CostLookupWanted } from "@/lib/openart-cost-lookup";
export {
  lookupCostFromItems,
  lookupDefaultCostSync,
} from "@/lib/openart-cost-lookup";

const DATA_DIR = path.join(process.cwd(), ".data");
const CACHE_FILE = path.join(DATA_DIR, "openart-cost-cache.json");

export interface CostCacheFile {
  updatedAt: string;
  source: "openart_model_cost";
  items: CostCacheItem[];
}

async function loadDiskCache(): Promise<CostCacheItem[]> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CostCacheFile;
    if (Array.isArray(parsed.items) && parsed.items.length) return parsed.items;
  } catch {
    // ignore missing/invalid cache
  }
  return [];
}

export async function getCostCacheItems(): Promise<CostCacheItem[]> {
  const disk = await loadDiskCache();
  if (!disk.length) return OPENART_COST_DEFAULTS;
  // Merge defaults under disk items so newer syncs win on exact keys.
  const map = new Map<string, CostCacheItem>();
  for (const item of OPENART_COST_DEFAULTS) {
    map.set(cacheKey(item), item);
  }
  for (const item of disk) {
    map.set(cacheKey(item), item);
  }
  return [...map.values()];
}

function cacheKey(item: CostCacheItem): string {
  return [
    item.model,
    item.mode,
    String(item.config.resolution ?? item.config.resolutionTier ?? ""),
    String(item.config.duration ?? ""),
    String(item.config.generateAudio ?? item.config.generateSound ?? ""),
    String(item.config.aspectRatio ?? ""),
  ].join("|");
}

export async function saveCostCache(items: CostCacheItem[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload: CostCacheFile = {
    updatedAt: new Date().toISOString(),
    source: "openart_model_cost",
    items,
  };
  await writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

export async function lookupCachedCost(
  wanted: CostLookupWanted,
): Promise<CostLookupResult | null> {
  const items = await getCostCacheItems();
  return lookupCostFromItems(items, wanted);
}
