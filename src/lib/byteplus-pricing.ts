/**
 * Veronix customer pricing from BytePlus token economics.
 *
 * Prepaid pack: $29.4 / 14,000,000 tokens → $0.0021 per 1K tokens.
 * Console estimate UI may show $0.007/1K; we bill from your pack rate.
 * Sell = cost × 1.55 (55% markup).
 * Display credits use a small USD unit so balances feel large.
 */

/** Pack price and token balance (BytePlus prepaid). */
export const BYTEPLUS_PACK_USD = 29.4;
export const BYTEPLUS_PACK_TOKENS = 14_000_000;
/** $29.4 ÷ 14,000,000 × 1000 */
export const BYTEPLUS_TOKEN_USD_PER_1K =
  (BYTEPLUS_PACK_USD / BYTEPLUS_PACK_TOKENS) * 1000;
export const BYTEPLUS_IMAGE_COST_USD = 0.04;
export const BYTEPLUS_FPS = 24;
/** Profit markup over BytePlus cost (55%). */
export const VERONIX_PROFIT_MARKUP = 1.55;
/** Customer wallet unit — $0.0001 per credit (×10 feel vs $0.001). */
export const VERONIX_CREDIT_USD = 0.0001;

export const VIDEO_RES_DIMS = {
  "480p": { width: 864, height: 480 },
  "720p": { width: 1280, height: 720 },
} as const;

export type VeronixVideoResolution = keyof typeof VIDEO_RES_DIMS;

/** Only 480p / 720p — 1080p and 4K are clamped to 720p. */
export function normalizeVideoResolution(
  resolution?: string | null,
): VeronixVideoResolution {
  const r = String(resolution || "720p").trim().toLowerCase();
  if (r.includes("480") || r === "std") return "480p";
  return "720p";
}

export function clampVideoDurationSeconds(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(4, Math.min(15, Number.isFinite(n) ? n : 5));
}

/** BytePlus: tokens = (W × H × fps × duration) / 1024 × count */
export function estimateBytePlusTokens(
  durationSec: number,
  resolution?: string | null,
  videoCount = 1,
): number {
  const { width, height } = VIDEO_RES_DIMS[normalizeVideoResolution(resolution)];
  const duration = clampVideoDurationSeconds(durationSec);
  const count = Math.max(1, Math.round(videoCount) || 1);
  return ((width * height * BYTEPLUS_FPS * duration) / 1024) * count;
}

export function bytePlusCostUsd(tokens: number): number {
  return (tokens / 1000) * BYTEPLUS_TOKEN_USD_PER_1K;
}

export function withProfitMarkup(costUsd: number): number {
  return costUsd * VERONIX_PROFIT_MARKUP;
}

export function usdToVeronixCredits(sellUsd: number): number {
  if (!Number.isFinite(sellUsd) || sellUsd <= 0) return 1;
  return Math.max(1, Math.round(sellUsd / VERONIX_CREDIT_USD));
}

/** Wallet debit for one Veronix video (4–15s, 480p/720p). Uses $0.001/credit standard. */
export function quoteVeronixVideoCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  videoCount?: number;
}): number {
  const tokens = estimateBytePlusTokens(
    input.duration ?? 5,
    input.resolution,
    input.videoCount ?? 1,
  );
  const sellUsd = withProfitMarkup(bytePlusCostUsd(tokens));
  return Math.max(1, Math.ceil(sellUsd / 0.001));
}

/** Wallet debit for Veronix images ($0.04 cost × 1.55). Uses $0.001/credit standard. */
export function quoteVeronixImageCredits(imageCount = 1): number {
  const count = Math.max(1, Math.round(imageCount) || 1);
  return Math.max(
    1,
    Math.ceil(withProfitMarkup(BYTEPLUS_IMAGE_COST_USD * count) / 0.001),
  );
}

export function isVeronixVideoModel(modelId?: string | null, mcpModel?: string | null): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === "veronix" ||
    id === "seedance-2-mini" ||
    mcp.includes("seedance") ||
    mcp.includes("byte-plus-seedance")
  );
}

export function isVeronixImageModel(modelId?: string | null, mcpModel?: string | null): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === "vyronix-image" ||
    mcp.includes("seedream") ||
    mcp.includes("byte-plus-seedream")
  );
}
