import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OPENART_COST_DEFAULTS,
  type CostCacheItem,
} from "@/lib/openart-cost-defaults";

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

function scoreMatch(
  item: CostCacheItem,
  wanted: {
    model: string;
    mode: string;
    resolution?: string;
    duration?: number;
    generateAudio?: boolean;
    aspectRatio?: string;
  },
): number {
  if (item.model !== wanted.model || item.mode !== wanted.mode) return -1;
  let score = 0;
  const res = String(item.config.resolution ?? item.config.resolutionTier ?? "").toLowerCase();
  const wantRes = (wanted.resolution || "").toLowerCase();
  if (wantRes && res) {
    if (res === wantRes) score += 50;
    else if (res.includes(wantRes) || wantRes.includes(res)) score += 20;
    // Kling: UI 720p maps to std — treat as equivalent for cache hits.
    else if (
      (wantRes === "std" && ["360p", "480p", "720p", "std"].includes(res)) ||
      (res === "std" && ["360p", "480p", "720p", "std"].includes(wantRes)) ||
      (wantRes === "pro" && ["1080p", "1k", "pro"].includes(res)) ||
      (res === "pro" && ["1080p", "1k", "pro"].includes(wantRes))
    ) {
      score += 45;
    } else score -= 10;
  }
  const dur = Number(item.config.duration);
  if (wanted.duration && Number.isFinite(dur) && dur > 0) {
    if (dur === wanted.duration) score += 40;
    else score += Math.max(0, 20 - Math.abs(dur - wanted.duration));
  }
  const hasAudioField =
    item.config.generateAudio !== undefined || item.config.generateSound !== undefined;
  if (typeof wanted.generateAudio === "boolean" && hasAudioField) {
    const audio = Boolean(item.config.generateAudio ?? item.config.generateSound);
    // Audio must match exactly — otherwise price stays stuck when toggling «توليد صوت».
    if (audio !== wanted.generateAudio) return -1;
    score += 80;
  }
  const ar = String(item.config.aspectRatio ?? "");
  if (wanted.aspectRatio && ar) {
    if (ar === wanted.aspectRatio) score += 10;
  }
  return score;
}

export type CostLookupWanted = {
  model: string;
  mode: string;
  resolution?: string;
  duration?: number;
  generateAudio?: boolean;
  aspectRatio?: string;
};

export type CostLookupResult = {
  totalCredits: number;
  unitCredits: number;
  config: Record<string, unknown>;
  scaled: boolean;
};

/** Shared matcher — used by server cache + client static table (same prices). */
export function lookupCostFromItems(
  items: CostCacheItem[],
  wanted: CostLookupWanted,
): CostLookupResult | null {
  let best: CostCacheItem | null = null;
  let bestScore = -1;
  for (const item of items) {
    const score = scoreMatch(item, wanted);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best || bestScore < 0) return null;

  const baseDuration = Number(best.config.duration);
  const wantDuration = wanted.duration;
  let totalCredits = best.totalCredits;
  let scaled = false;

  if (
    wantDuration &&
    Number.isFinite(baseDuration) &&
    baseDuration > 0 &&
    wantDuration !== baseDuration
  ) {
    totalCredits = Math.max(1, Math.round((best.totalCredits * wantDuration) / baseDuration));
    scaled = true;
  }

  return {
    totalCredits,
    unitCredits: totalCredits,
    config: {
      ...best.config,
      ...(wantDuration ? { duration: wantDuration } : {}),
      ...(wanted.resolution ? { resolution: wanted.resolution } : {}),
      ...(wanted.aspectRatio ? { aspectRatio: wanted.aspectRatio } : {}),
      ...(typeof wanted.generateAudio === "boolean"
        ? { generateAudio: wanted.generateAudio }
        : {}),
    },
    scaled,
  };
}

/**
 * Instant client/server estimate from the seeded cost table (no disk / network).
 * Same math as cache hits when `.data/openart-cost-cache.json` is empty.
 */
export function lookupDefaultCostSync(
  wanted: CostLookupWanted,
): CostLookupResult | null {
  return lookupCostFromItems(OPENART_COST_DEFAULTS, wanted);
}

export async function lookupCachedCost(
  wanted: CostLookupWanted,
): Promise<CostLookupResult | null> {
  const items = await getCostCacheItems();
  return lookupCostFromItems(items, wanted);
}
