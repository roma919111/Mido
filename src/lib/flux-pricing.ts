/**
 * FLUX 3 video pricing — BFL list cost × {@link VERONIX_PROFIT_MARKUP} → wallet credits.
 * Wallet: $1 = 1,000 credits · 1 credit = $0.001 USD
 */

import { CREDIT_USD } from "@/config/modelPricing";
import { VERONIX_PROFIT_MARKUP } from "@/lib/byteplus-pricing";
import {
  FLUX_VIDEO_MODEL_ID,
  FLUX_VIDEO_USD_PER_SEC,
  type FluxVideoMode,
  type FluxVideoQuality,
} from "@/lib/flux-constants";

export type FluxVideoCreditBreakdown = {
  quality: FluxVideoQuality;
  mode: FluxVideoMode;
  durationSec: number;
  creditsPerSecond: number;
  outputCredits: number;
  walletCredits: number;
  costUsd: number;
  sellUsd: number;
  draft: boolean;
};

export function isFluxVideoModel(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === FLUX_VIDEO_MODEL_ID ||
    id.includes("flux-3") ||
    mcp.includes("flux-3") ||
    (id.includes("flux") && id.includes("video"))
  );
}

export function normalizeFluxVideoQuality(
  resolution?: string | null,
): FluxVideoQuality {
  const r = String(resolution || "HD").trim().toLowerCase();
  if (
    r === "draft" ||
    r === "hd-draft" ||
    r.includes("draft") ||
    r === "std"
  ) {
    return "draft";
  }
  if (
    r === "fhd" ||
    r === "fullhd" ||
    r.includes("1080") ||
    r.includes("1920") ||
    r === "2k" ||
    r === "pro"
  ) {
    return "fhd";
  }
  return "hd";
}

export function fluxQualityToApiResolution(
  quality: FluxVideoQuality,
): "hd" | "fhd" {
  return quality === "fhd" ? "fhd" : "hd";
}

export function clampFluxVideoDuration(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(5, Math.min(20, Number.isFinite(n) ? n : 5));
}

export function fluxVideoMode(input: {
  hasVideoReferences?: boolean | null;
  hasImages?: boolean | null;
}): FluxVideoMode {
  if (input.hasVideoReferences) return "v2v";
  if (input.hasImages) return "i2v";
  return "t2v";
}

export function fluxVideoCostUsdPerSecond(
  quality: FluxVideoQuality,
  mode: FluxVideoMode = "t2v",
): number {
  const billedQuality: FluxVideoQuality = quality === "draft" ? "draft" : quality;
  return FLUX_VIDEO_USD_PER_SEC[mode][billedQuality];
}

export function fluxVideoCreditsPerSecond(
  resolution?: string | null,
  hasVideoReferences?: boolean | null,
): number {
  const quality = normalizeFluxVideoQuality(resolution);
  const mode = fluxVideoMode({ hasVideoReferences });
  const sellUsd =
    fluxVideoCostUsdPerSecond(quality, mode) * VERONIX_PROFIT_MARKUP;
  return Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
}

export function quoteFluxVideoBreakdown(input: {
  duration?: number | null;
  resolution?: string | null;
  hasVideoReferences?: boolean | null;
  hasImages?: boolean | null;
  videoCount?: number;
}): FluxVideoCreditBreakdown {
  const quality = normalizeFluxVideoQuality(input.resolution);
  const durationSec = clampFluxVideoDuration(input.duration);
  const mode = fluxVideoMode({
    hasVideoReferences: input.hasVideoReferences,
    hasImages: input.hasImages,
  });
  const count = Math.max(1, input.videoCount ?? 1);
  const creditsPerSecond = fluxVideoCreditsPerSecond(
    quality,
    Boolean(input.hasVideoReferences),
  );
  const outputCredits = Math.ceil(creditsPerSecond * durationSec * count);
  const walletCredits = Math.max(1, outputCredits);
  const listCostUsd =
    fluxVideoCostUsdPerSecond(quality, mode) * durationSec * count;

  return {
    quality,
    mode,
    durationSec,
    creditsPerSecond,
    outputCredits,
    walletCredits,
    costUsd: listCostUsd,
    sellUsd: walletCredits * CREDIT_USD,
    draft: quality === "draft",
  };
}

export function quoteFluxVideoCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  hasVideoReferences?: boolean | null;
  hasImages?: boolean | null;
  videoCount?: number;
}): number {
  return quoteFluxVideoBreakdown(input).walletCredits;
}

export function formatFluxVideoPricingNote(
  breakdown: FluxVideoCreditBreakdown,
): string {
  const tier = breakdown.draft ? "Draft HD" : breakdown.quality.toUpperCase();
  const path =
    breakdown.mode === "v2v"
      ? "video→video"
      : breakdown.mode === "i2v"
        ? "image→video"
        : "text→video";
  return `FLUX 3: ${tier} ${path} ${breakdown.outputCredits} = ${breakdown.walletCredits} كريدت (${breakdown.creditsPerSecond}/ث · تكلفة × ${VERONIX_PROFIT_MARKUP})`;
}

export { FLUX_VIDEO_MODEL_ID };
