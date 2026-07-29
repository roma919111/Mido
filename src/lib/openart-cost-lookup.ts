import {
  OPENART_COST_DEFAULTS,
  type CostCacheItem,
} from "@/lib/openart-cost-defaults";

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

function scoreMatch(item: CostCacheItem, wanted: CostLookupWanted): number {
  if (item.model !== wanted.model || item.mode !== wanted.mode) return -1;
  let score = 0;
  const res = String(
    item.config.resolution ?? item.config.resolutionTier ?? "",
  ).toLowerCase();
  const wantRes = (wanted.resolution || "").toLowerCase();
  if (wantRes && res) {
    if (res === wantRes) score += 50;
    else if (res.includes(wantRes) || wantRes.includes(res)) score += 20;
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
    item.config.generateAudio !== undefined ||
    item.config.generateSound !== undefined;
  if (typeof wanted.generateAudio === "boolean" && hasAudioField) {
    const audio = Boolean(
      item.config.generateAudio ?? item.config.generateSound,
    );
    if (audio !== wanted.generateAudio) return -1;
    score += 80;
  }
  const ar = String(item.config.aspectRatio ?? "");
  if (wanted.aspectRatio && ar) {
    if (ar === wanted.aspectRatio) score += 10;
  }
  return score;
}

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
    totalCredits = Math.max(
      1,
      Math.round((best.totalCredits * wantDuration) / baseDuration),
    );
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
