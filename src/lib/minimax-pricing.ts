/**
 * MiniMax H3 pricing — platform list cost × {@link VERONIX_PROFIT_MARKUP} → wallet credits.
 *
 * Output video (per second):
 *   768P — $0.08/s
 *   2K   — $0.13/s
 *
 * Input materials:
 *   Audio — free
 *   Image — first 5 free, then $0.04 each
 *   Video — input duration × output resolution rate
 *
 * Wallet: $1 = 1,000 credits · 1 credit = $0.001 USD
 */

import {
  CREDIT_USD,
  usdToCredits,
} from "@/config/modelPricing";
import { VERONIX_PROFIT_MARKUP } from "@/lib/byteplus-pricing";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import {
  MINIMAX_H3_DURATION_DEFAULT,
  MINIMAX_H3_DURATION_MAX,
  MINIMAX_H3_DURATION_MIN,
  MINIMAX_H3_EXTRA_IMAGE_USD,
  MINIMAX_H3_FREE_REFERENCE_IMAGES,
  MINIMAX_H3_MODEL_ID,
  MINIMAX_H3_OUTPUT_USD_PER_SEC,
  type MiniMaxH3Quality,
} from "@/lib/minimax-constants";

export type MiniMaxH3CreditBreakdown = {
  quality: MiniMaxH3Quality;
  durationSec: number;
  creditsPerSecond: number;
  outputCredits: number;
  extraImageCredits: number;
  referenceVideoCredits: number;
  walletCredits: number;
  costUsd: number;
  sellUsd: number;
};

export function isMiniMaxH3Model(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === MINIMAX_H3_MODEL_ID ||
    id.includes("minimax-h3") ||
    mcp.includes("minimax-h3")
  );
}

/** VYRONIX branded video uses the MiniMax H3 backend. */
export function usesMiniMaxVideoBackend(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  if (id === VERONIX_MODEL_ID) return true;
  return isMiniMaxH3Model(modelId, mcpModel);
}

export function normalizeMiniMaxH3Quality(
  resolution?: string | null,
): MiniMaxH3Quality {
  const r = String(resolution || "768p").trim().toLowerCase();
  if (r === "2k" || r.includes("1440") || r.includes("2160") || r.includes("2k")) {
    return "2k";
  }
  if (r.includes("768")) return "768p";
  if (r.includes("720") || r.includes("1080") || r.includes("480")) return "768p";
  return "768p";
}

export function clampMiniMaxH3Duration(duration?: number | null): number {
  const n = Math.round(Number(duration) || MINIMAX_H3_DURATION_DEFAULT);
  return Math.max(
    MINIMAX_H3_DURATION_MIN,
    Math.min(
      MINIMAX_H3_DURATION_MAX,
      Number.isFinite(n) ? n : MINIMAX_H3_DURATION_DEFAULT,
    ),
  );
}

export function miniMaxH3CostUsdPerSecond(quality: MiniMaxH3Quality): number {
  return MINIMAX_H3_OUTPUT_USD_PER_SEC[quality];
}

/** List cost × 55% markup → credits per output second. */
export function miniMaxH3CreditsPerSecond(
  resolution?: string | null,
): number {
  const quality = normalizeMiniMaxH3Quality(resolution);
  const sellUsd = miniMaxH3CostUsdPerSecond(quality) * VERONIX_PROFIT_MARKUP;
  return Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
}

export function quoteMiniMaxH3ExtraImageCredits(
  referenceImageCount?: number | null,
): number {
  const count = Math.max(0, Math.round(Number(referenceImageCount) || 0));
  const billable = Math.max(0, count - MINIMAX_H3_FREE_REFERENCE_IMAGES);
  if (billable <= 0) return 0;
  const sellUsd = billable * MINIMAX_H3_EXTRA_IMAGE_USD * VERONIX_PROFIT_MARKUP;
  return usdToCredits(sellUsd);
}

export function quoteMiniMaxH3ReferenceVideoCredits(input: {
  referenceVideoDurationSec?: number | null;
  resolution?: string | null;
}): number {
  const duration = Math.max(
    0,
    Math.round(Number(input.referenceVideoDurationSec) || 0),
  );
  if (duration <= 0) return 0;
  const perSec = miniMaxH3CreditsPerSecond(input.resolution);
  return Math.max(0, Math.ceil(perSec * duration));
}

export function quoteMiniMaxH3VideoBreakdown(input: {
  duration?: number | null;
  resolution?: string | null;
  referenceImageCount?: number | null;
  referenceVideoDurationSec?: number | null;
  videoCount?: number;
}): MiniMaxH3CreditBreakdown {
  const quality = normalizeMiniMaxH3Quality(input.resolution);
  const durationSec = clampMiniMaxH3Duration(input.duration);
  const count = Math.max(1, input.videoCount ?? 1);
  const creditsPerSecond = miniMaxH3CreditsPerSecond(quality);
  const outputCredits = Math.ceil(creditsPerSecond * durationSec * count);
  const extraImageCredits = quoteMiniMaxH3ExtraImageCredits(
    input.referenceImageCount,
  );
  const referenceVideoCredits = quoteMiniMaxH3ReferenceVideoCredits({
    referenceVideoDurationSec: input.referenceVideoDurationSec,
    resolution: quality,
  });
  const walletCredits = Math.max(
    1,
    outputCredits + extraImageCredits + referenceVideoCredits,
  );
  const listCostUsd =
    miniMaxH3CostUsdPerSecond(quality) * durationSec * count +
    Math.max(
      0,
      Math.max(0, Math.round(Number(input.referenceImageCount) || 0) -
        MINIMAX_H3_FREE_REFERENCE_IMAGES),
    ) *
      MINIMAX_H3_EXTRA_IMAGE_USD +
    miniMaxH3CostUsdPerSecond(quality) *
      Math.max(0, Math.round(Number(input.referenceVideoDurationSec) || 0));

  return {
    quality,
    durationSec,
    creditsPerSecond,
    outputCredits,
    extraImageCredits,
    referenceVideoCredits,
    walletCredits,
    costUsd: listCostUsd,
    sellUsd: walletCredits * CREDIT_USD,
  };
}

export function quoteMiniMaxH3VideoCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  referenceImageCount?: number | null;
  referenceVideoDurationSec?: number | null;
  videoCount?: number;
}): number {
  return quoteMiniMaxH3VideoBreakdown(input).walletCredits;
}

export function formatMiniMaxH3PricingNote(
  breakdown: MiniMaxH3CreditBreakdown,
): string {
  const parts = [
    `${breakdown.quality} ${breakdown.outputCredits}`,
    breakdown.extraImageCredits > 0
      ? `صور +${breakdown.extraImageCredits}`
      : null,
    breakdown.referenceVideoCredits > 0
      ? `فيديو مرجع +${breakdown.referenceVideoCredits}`
      : null,
  ].filter(Boolean);
  return `MiniMax H3: ${parts.join(" + ")} = ${breakdown.walletCredits} كريدت (${breakdown.creditsPerSecond}/ث · تكلفة × ${VERONIX_PROFIT_MARKUP})`;
}

/** Build central pricing table rates from list cost. */
export function miniMaxH3TierRates(resolution?: string | null): {
  noAudio: number;
  withAudio: number;
} {
  const perSec = miniMaxH3CreditsPerSecond(resolution);
  return { noAudio: perSec, withAudio: perSec };
}

export { MINIMAX_H3_MODEL_ID };
