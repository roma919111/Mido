/**
 * Gemini Omni Flash video pricing — list cost × {@link VERONIX_PROFIT_MARKUP}.
 * Wallet: $1 = 1,000 credits · 1 credit = $0.001 USD
 */

import { CREDIT_USD, usdToCredits } from "@/config/modelPricing";
import { VERONIX_PROFIT_MARKUP } from "@/lib/byteplus-pricing";
import {
  GEMINI_OMNI_FLASH_MODEL_ID,
  GEMINI_VIDEO_USD_PER_SEC,
} from "@/lib/gemini-constants";

export type GeminiVideoCreditBreakdown = {
  durationSec: number;
  creditsPerSecond: number;
  outputCredits: number;
  walletCredits: number;
  costUsd: number;
  sellUsd: number;
};

export function isGeminiOmniFlashModel(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === GEMINI_OMNI_FLASH_MODEL_ID ||
    id.includes("gemini-omni") ||
    mcp.includes("gemini-omni")
  );
}

export function clampGeminiVideoDuration(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(3, Math.min(10, Number.isFinite(n) ? n : 5));
}

export function geminiVideoCreditsPerSecond(): number {
  const sellUsd = GEMINI_VIDEO_USD_PER_SEC * VERONIX_PROFIT_MARKUP;
  return Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
}

export function quoteGeminiVideoBreakdown(input: {
  duration?: number | null;
  videoCount?: number;
}): GeminiVideoCreditBreakdown {
  const durationSec = clampGeminiVideoDuration(input.duration);
  const count = Math.max(1, input.videoCount ?? 1);
  const creditsPerSecond = geminiVideoCreditsPerSecond();
  const outputCredits = Math.ceil(creditsPerSecond * durationSec * count);
  const walletCredits = Math.max(1, outputCredits);
  const costUsd = GEMINI_VIDEO_USD_PER_SEC * durationSec * count;

  return {
    durationSec,
    creditsPerSecond,
    outputCredits,
    walletCredits,
    costUsd,
    sellUsd: walletCredits * CREDIT_USD,
  };
}

export function quoteGeminiVideoCredits(input: {
  duration?: number | null;
  videoCount?: number;
}): number {
  return quoteGeminiVideoBreakdown(input).walletCredits;
}

export function formatGeminiVideoPricingNote(
  breakdown: GeminiVideoCreditBreakdown,
): string {
  return `Gemini Omni Flash: ${breakdown.outputCredits} كريدت (${breakdown.creditsPerSecond}/ث · $${GEMINI_VIDEO_USD_PER_SEC} × ${VERONIX_PROFIT_MARKUP})`;
}

export { GEMINI_OMNI_FLASH_MODEL_ID };
