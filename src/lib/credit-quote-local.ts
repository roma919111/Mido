/**
 * Client-safe credit pricing (no node:fs).
 * Veronix video/image use BytePlus token math (+55% markup).
 * PixVerse V6: (وضوح + صوت + فيديو) × 1 × 1.55 each — no ×1.8.
 * Other catalog models keep the legacy seeded table ×1.8 for display only.
 */

import { getCatalogModel, resolveMcpModel, type CatalogModel } from "@/lib/model-catalog";
import { audioParamForMcpModel, mapResolutionForMcpModel } from "@/lib/model-params";
import { lookupDefaultCostSync } from "@/lib/openart-cost-lookup";
import {
  VERONIX_CREDIT_MULTIPLIER,
  toVeronixCredits,
  withMultiplierNote,
  type QuoteInput,
  type QuoteResult,
} from "@/lib/credit-multiplier";
import {
  BYTEPLUS_TOKEN_USD_PER_1K,
  VERONIX_PROFIT_MARKUP,
  isVeronixImageModel,
  isVeronixVideoModel,
  normalizeVideoResolution,
  quoteVeronixImageCredits,
} from "@/lib/byteplus-pricing";
import { calculateVideoCredits } from "@/config/modelPricing";
import {
  formatPixVersePricingNote,
  isPixVerseModel,
  normalizePixVerseQuality,
  quotePixVerseVideoBreakdown,
} from "@/lib/pixverse-pricing";

function fallbackEstimate(input: QuoteInput): number {
  if (input.media === "image") return 15;
  const duration = input.duration ?? 5;
  const res = (input.resolution || "720p").toLowerCase();
  const base = res.includes("1080") || res.includes("1k") ? 150 : 70;
  return Math.round(base * (duration / 5));
}

function resolveMode(
  catalog: CatalogModel | null | undefined,
  input: QuoteInput,
): string {
  const requested =
    input.mode || (input.media === "image" ? "text2image" : "text2video");
  const supported = catalog?.modes ?? [];
  if (!supported.length) return requested;
  if (supported.includes(requested)) return requested;
  if (input.media === "video") {
    return (
      supported.find((m) => m.includes("video")) ||
      supported[0] ||
      requested
    );
  }
  return supported.find((m) => m.includes("image")) || supported[0] || requested;
}

function buildParams(
  input: QuoteInput,
  mcpModel: string,
): Record<string, unknown> {
  if (input.media === "image") {
    if (mcpModel.includes("gpt-image")) {
      return {
        imageCount: input.imageCount ?? 1,
        aspectRatio: input.aspectRatio ?? "4:3",
        resolutionTier: "2k",
        quality: "medium",
      };
    }
    if (mcpModel.includes("kling")) {
      return {
        imageCount: input.imageCount ?? 1,
        aspectRatio: input.aspectRatio ?? "4:3",
        resolution: "1k",
      };
    }
    if (mcpModel.includes("seedream")) {
      return {
        imageCount: input.imageCount ?? 1,
        aspectRatio: input.aspectRatio ?? "4:3",
        resolution: "2K",
      };
    }
    return {
      imageCount: input.imageCount ?? 1,
      aspectRatio: input.aspectRatio ?? "1:1",
      ...(input.resolution ? { resolution: input.resolution } : {}),
    };
  }

  const catalog = getCatalogModel(input.modelId);
  const resolution = mapResolutionForMcpModel(
    mcpModel,
    input.resolution || catalog?.resolutionDefault || "720p",
  );
  const hasResolutionControl = Array.isArray(catalog?.resolutions)
    ? catalog.resolutions.length > 0
    : Boolean(resolution);
  return {
    videoCount: input.videoCount ?? 1,
    duration: input.duration ?? 5,
    ...(hasResolutionControl && resolution ? { resolution } : {}),
    aspectRatio: input.aspectRatio ?? "16:9",
    ...audioParamForMcpModel(
      mcpModel,
      input.generateAudio,
      catalog?.audioParam,
    ),
  };
}

function quoteBytePlusResult(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult | null {
  if (input.media === "video" && isVeronixVideoModel(input.modelId, mcpModel)) {
    const resolution = normalizeVideoResolution(
      typeof params.resolution === "string"
        ? params.resolution
        : input.resolution,
    );
    const totalCredits = calculateVideoCredits({
      model: input.modelId,
      quality: resolution,
      hasAudio: input.generateAudio,
      durationInSeconds: input.duration ?? 5,
      videoCount: input.videoCount ?? 1,
    });
    return {
      modelId: input.modelId,
      mcpModel,
      mode,
      totalCredits,
      unitCredits: totalCredits,
      openArtCredits: totalCredits,
      multiplier: VERONIX_PROFIT_MARKUP,
      available: available || true,
      config: { ...params, resolution },
      pricingNote: `BytePlus tokens × $${BYTEPLUS_TOKEN_USD_PER_1K}/1K × ${VERONIX_PROFIT_MARKUP} markup`,
      source: "estimate",
    };
  }

  if (input.media === "image" && isVeronixImageModel(input.modelId, mcpModel)) {
    const totalCredits = quoteVeronixImageCredits(input.imageCount ?? 1);
    return {
      modelId: input.modelId,
      mcpModel,
      mode,
      totalCredits,
      unitCredits: totalCredits,
      openArtCredits: totalCredits,
      multiplier: VERONIX_PROFIT_MARKUP,
      available: available || true,
      config: params,
      pricingNote: `BytePlus image $${0.04} × ${VERONIX_PROFIT_MARKUP} markup`,
      source: "estimate",
    };
  }

  return null;
}

function quotePixVerseResult(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult | null {
  if (input.media !== "video" || !isPixVerseModel(input.modelId, mcpModel)) {
    return null;
  }
  const resolution = normalizePixVerseQuality(
    typeof params.resolution === "string"
      ? params.resolution
      : input.resolution,
  );
  const hasVideoReferences = Boolean(input.hasVideoReferences);
  const breakdown = quotePixVerseVideoBreakdown({
    duration: input.duration,
    resolution,
    generateAudio: input.generateAudio,
    hasVideoReferences,
    videoCount: input.videoCount ?? 1,
  });
  const totalCredits = breakdown.walletCredits;
  return {
    modelId: input.modelId,
    mcpModel,
    mode,
    totalCredits,
    unitCredits: totalCredits,
    openArtCredits: breakdown.apiCredits,
    multiplier: VERONIX_PROFIT_MARKUP,
    available: available || true,
    config: {
      ...params,
      resolution,
      hasVideoReferences,
      clarityCredits: breakdown.clarityCredits,
      audioCredits: breakdown.audioCredits,
      videoRefCredits: breakdown.videoRefCredits,
    },
    pricingNote: formatPixVersePricingNote(breakdown),
    source: "estimate",
  };
}

/**
 * Instant UI pricing — duration/resolution changes update credits immediately.
 */
export function quoteCreditsLocal(input: QuoteInput): QuoteResult {
  const catalog = getCatalogModel(input.modelId);
  const mcpModel = catalog ? resolveMcpModel(catalog) : input.modelId;
  const available = Boolean(catalog?.available && catalog.mcpId);
  const mode = resolveMode(catalog, input);
  const params = buildParams(input, mcpModel);

  const bytePlus = quoteBytePlusResult(input, mcpModel, mode, params, available);
  if (bytePlus) return bytePlus;

  const pixVerse = quotePixVerseResult(input, mcpModel, mode, params, available);
  if (pixVerse) return pixVerse;

  const mappedRes =
    typeof params.resolution === "string"
      ? params.resolution
      : mapResolutionForMcpModel(mcpModel, input.resolution);

  const cached = lookupDefaultCostSync({
    model: mcpModel,
    mode,
    resolution: mappedRes,
    duration: input.duration,
    generateAudio: input.generateAudio,
    aspectRatio: input.aspectRatio,
  });

  if (cached) {
    const openArtCredits = cached.totalCredits;
    const totalCredits = toVeronixCredits(openArtCredits);
    return {
      modelId: input.modelId,
      mcpModel,
      mode,
      totalCredits,
      unitCredits: totalCredits,
      openArtCredits,
      multiplier: VERONIX_CREDIT_MULTIPLIER,
      available: available || true,
      config: cached.config,
      pricingNote: withMultiplierNote(
        cached.scaled
          ? "Local cost table (duration scaled)"
          : "Local cost table",
      ),
      source: "cache",
      cached: true,
    };
  }

  const openArtCredits = fallbackEstimate(input);
  const totalCredits = toVeronixCredits(openArtCredits);

  return {
    modelId: input.modelId,
    mcpModel,
    mode,
    totalCredits,
    unitCredits: totalCredits,
    openArtCredits,
    multiplier: VERONIX_CREDIT_MULTIPLIER,
    available,
    config: params,
    pricingNote: withMultiplierNote(
      available ? "Local estimate" : "Estimate for unavailable model",
    ),
    source: "estimate",
  };
}

export type { QuoteInput, QuoteResult };
