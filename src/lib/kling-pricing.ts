/**
 * Kling 3.0 Omni pricing — platform list cost × {@link VERONIX_PROFIT_MARKUP} → wallet credits.
 *
 * Output video (per second):
 *   720p  — $0.10/s (no audio) · $0.15/s (native audio)
 *   1080p — $0.15/s · $0.20/s
 *   4K    — $0.35/s · $0.42/s
 *
 * Wallet: $1 = 1,000 credits · 1 credit = $0.001 USD
 */

import { CREDIT_USD } from "@/config/modelPricing";
import { VERONIX_PROFIT_MARKUP } from "@/lib/byteplus-pricing";
import {
  KLING_OMNI_MODEL_ID,
  KLING_OMNI_OUTPUT_USD_PER_SEC,
  type KlingOmniQuality,
} from "@/lib/kling-constants";

export type KlingOmniCreditBreakdown = {
  quality: KlingOmniQuality;
  durationSec: number;
  withAudio: boolean;
  creditsPerSecond: number;
  outputCredits: number;
  walletCredits: number;
  costUsd: number;
  sellUsd: number;
};

export function isKlingOmniModel(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === KLING_OMNI_MODEL_ID ||
    id.includes("kling-3-omni") ||
    mcp.includes("kling-3-omni") ||
    (mcp.includes("kling") && !mcp.includes("image"))
  );
}

export function normalizeKlingOmniQuality(
  resolution?: string | null,
): KlingOmniQuality {
  const r = String(resolution || "720p").trim().toLowerCase();
  if (r === "4k" || r.includes("2160")) return "4k";
  if (
    r === "1080p" ||
    r.includes("1080") ||
    r === "pro" ||
    r === "1k" ||
    r.includes("1440")
  ) {
    return "1080p";
  }
  if (r === "720p" || r.includes("720") || r === "std") return "720p";
  return "720p";
}

export function clampKlingOmniDuration(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(3, Math.min(15, Number.isFinite(n) ? n : 5));
}

export function klingOmniCostUsdPerSecond(
  quality: KlingOmniQuality,
  withAudio: boolean,
): number {
  const tier = KLING_OMNI_OUTPUT_USD_PER_SEC[quality];
  return withAudio ? tier.withAudio : tier.noAudio;
}

/** List cost × 55% markup → credits per output second. */
export function klingOmniCreditsPerSecond(
  resolution?: string | null,
  withAudio?: boolean,
): number {
  const quality = normalizeKlingOmniQuality(resolution);
  const sellUsd =
    klingOmniCostUsdPerSecond(quality, Boolean(withAudio)) *
    VERONIX_PROFIT_MARKUP;
  return Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
}

export function quoteKlingOmniVideoBreakdown(input: {
  duration?: number | null;
  resolution?: string | null;
  generateAudio?: boolean | null;
  videoCount?: number;
}): KlingOmniCreditBreakdown {
  const quality = normalizeKlingOmniQuality(input.resolution);
  const durationSec = clampKlingOmniDuration(input.duration);
  const withAudio = Boolean(input.generateAudio);
  const count = Math.max(1, input.videoCount ?? 1);
  const creditsPerSecond = klingOmniCreditsPerSecond(quality, withAudio);
  const outputCredits = Math.ceil(creditsPerSecond * durationSec * count);
  const walletCredits = Math.max(1, outputCredits);
  const listCostUsd =
    klingOmniCostUsdPerSecond(quality, withAudio) * durationSec * count;

  return {
    quality,
    durationSec,
    withAudio,
    creditsPerSecond,
    outputCredits,
    walletCredits,
    costUsd: listCostUsd,
    sellUsd: walletCredits * CREDIT_USD,
  };
}

export function quoteKlingOmniVideoCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  generateAudio?: boolean | null;
  videoCount?: number;
}): number {
  return quoteKlingOmniVideoBreakdown(input).walletCredits;
}

export function formatKlingOmniPricingNote(
  breakdown: KlingOmniCreditBreakdown,
): string {
  const audio = breakdown.withAudio ? "صوت" : "بدون صوت";
  return `Kling 3.0 Omni: ${breakdown.quality} ${audio} ${breakdown.outputCredits} = ${breakdown.walletCredits} كريدت (${breakdown.creditsPerSecond}/ث · تكلفة × ${VERONIX_PROFIT_MARKUP})`;
}

export function klingOmniTierRates(resolution?: string | null): {
  noAudio: number;
  withAudio: number;
} {
  return {
    noAudio: klingOmniCreditsPerSecond(resolution, false),
    withAudio: klingOmniCreditsPerSecond(resolution, true),
  };
}

export { KLING_OMNI_MODEL_ID };
