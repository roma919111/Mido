import { getActiveCatalog, getCatalogModel, resolveMcpModel } from "@/lib/model-catalog";
import { audioParamForMcpModel, mapResolutionForMcpModel } from "@/lib/model-params";
import { lookupCachedCost } from "@/lib/openart-cost-cache";
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
  quoteVeronixImageCredits,
} from "@/lib/byteplus-pricing";
import { calculateVideoCredits } from "@/config/modelPricing";
import {
  formatPixVersePricingNote,
  isPixVerseModel,
  normalizePixVerseQuality,
  quotePixVerseVideoBreakdown,
} from "@/lib/pixverse-pricing";
import {
  formatMiniMaxH3PricingNote,
  isMiniMaxH3Model,
  normalizeMiniMaxH3Quality,
  quoteMiniMaxH3VideoBreakdown,
  usesMiniMaxVideoBackend,
} from "@/lib/minimax-pricing";
import {
  formatGeminiVideoPricingNote,
  isGeminiOmniFlashModel,
  quoteGeminiVideoBreakdown,
} from "@/lib/gemini-pricing";
import {
  formatKlingOmniPricingNote,
  isKlingOmniModel,
  normalizeKlingOmniQuality,
  quoteKlingOmniVideoBreakdown,
} from "@/lib/kling-pricing";
import { isKlingVideoConfigured } from "@/lib/kling-video";
import {
  formatFluxVideoPricingNote,
  isFluxVideoModel,
  normalizeFluxVideoQuality,
  quoteFluxVideoBreakdown,
} from "@/lib/flux-pricing";
import { isFluxVideoConfigured } from "@/lib/flux-video";

export {
  VERONIX_CREDIT_MULTIPLIER,
  toVeronixCredits,
  withMultiplierNote,
  type QuoteInput,
  type QuoteResult,
} from "@/lib/credit-multiplier";

/** Re-export client-safe local quote for server callers that want sync pricing. */
export { quoteCreditsLocal } from "@/lib/credit-quote-local";

export interface QuoteOptions {
  /** Prefer seeded local cost cache (default true). */
  allowCache?: boolean;
}

function fallbackEstimate(input: QuoteInput): number {
  if (input.media === "image") return 15;
  const duration = input.duration ?? 5;
  const res = (input.resolution || "720p").toLowerCase();
  const base = res.includes("1080") || res.includes("1k") ? 150 : 70;
  return Math.round(base * (duration / 5));
}

function resolveMode(
  catalog: ReturnType<typeof getCatalogModel>,
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
    const resolution =
      typeof params.resolution === "string"
        ? params.resolution
        : input.resolution;
    const totalCredits = calculateVideoCredits({
      model: input.modelId,
      quality: resolution,
      hasAudio: input.generateAudio,
      hasVideoReferences: Boolean(input.hasVideoReferences),
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
      pricingNote: `BytePlus image $0.04 × ${VERONIX_PROFIT_MARKUP} markup`,
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

function quoteMiniMaxH3Result(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult | null {
  if (input.media !== "video" || !usesMiniMaxVideoBackend(input.modelId, mcpModel)) {
    return null;
  }
  const resolution = normalizeMiniMaxH3Quality(
    typeof params.resolution === "string"
      ? params.resolution
      : input.resolution,
  );
  const breakdown = quoteMiniMaxH3VideoBreakdown({
    duration: input.duration,
    resolution,
    referenceImageCount: input.referenceImageCount,
    referenceVideoDurationSec: input.referenceVideoDurationSec,
    videoCount: input.videoCount ?? 1,
  });
  return {
    modelId: input.modelId,
    mcpModel,
    mode,
    totalCredits: breakdown.walletCredits,
    unitCredits: breakdown.walletCredits,
    openArtCredits: breakdown.outputCredits,
    multiplier: VERONIX_PROFIT_MARKUP,
    available: available || true,
    config: {
      ...params,
      resolution,
      outputCredits: breakdown.outputCredits,
      extraImageCredits: breakdown.extraImageCredits,
      referenceVideoCredits: breakdown.referenceVideoCredits,
    },
    pricingNote: formatMiniMaxH3PricingNote(breakdown),
    source: "estimate",
  };
}

function quoteKlingOmniResult(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult | null {
  if (input.media !== "video" || !isKlingOmniModel(input.modelId, mcpModel)) {
    return null;
  }
  const resolution = normalizeKlingOmniQuality(
    typeof params.resolution === "string"
      ? params.resolution
      : input.resolution,
  );
  const breakdown = quoteKlingOmniVideoBreakdown({
    duration: input.duration,
    resolution,
    generateAudio: input.generateAudio,
    videoCount: input.videoCount ?? 1,
  });
  return {
    modelId: input.modelId,
    mcpModel,
    mode,
    totalCredits: breakdown.walletCredits,
    unitCredits: breakdown.walletCredits,
    openArtCredits: breakdown.outputCredits,
    multiplier: VERONIX_PROFIT_MARKUP,
    available: isKlingVideoConfigured() && (available || true),
    config: {
      ...params,
      resolution,
      outputCredits: breakdown.outputCredits,
    },
    pricingNote: formatKlingOmniPricingNote(breakdown),
    source: "estimate",
  };
}

function quoteFluxVideoResult(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult | null {
  if (input.media !== "video" || !isFluxVideoModel(input.modelId, mcpModel)) {
    return null;
  }
  const resolution = normalizeFluxVideoQuality(
    typeof params.resolution === "string"
      ? params.resolution
      : input.resolution,
  );
  const breakdown = quoteFluxVideoBreakdown({
    duration: input.duration,
    resolution,
    hasVideoReferences: input.hasVideoReferences,
    hasImages: (input.referenceImageCount ?? 0) > 0,
    videoCount: input.videoCount ?? 1,
  });
  return {
    modelId: input.modelId,
    mcpModel,
    mode,
    totalCredits: breakdown.walletCredits,
    unitCredits: breakdown.walletCredits,
    openArtCredits: breakdown.outputCredits,
    multiplier: VERONIX_PROFIT_MARKUP,
    available: isFluxVideoConfigured() && (available || true),
    config: {
      ...params,
      resolution,
      outputCredits: breakdown.outputCredits,
      fluxMode: breakdown.mode,
    },
    pricingNote: formatFluxVideoPricingNote(breakdown),
    source: "estimate",
  };
}

function quoteGeminiVideoResult(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult | null {
  if (input.media !== "video" || !isGeminiOmniFlashModel(input.modelId, mcpModel)) {
    return null;
  }
  const breakdown = quoteGeminiVideoBreakdown({
    duration: input.duration,
    videoCount: input.videoCount ?? 1,
  });
  return {
    modelId: input.modelId,
    mcpModel,
    mode,
    totalCredits: breakdown.walletCredits,
    unitCredits: breakdown.walletCredits,
    openArtCredits: breakdown.outputCredits,
    multiplier: VERONIX_PROFIT_MARKUP,
    available: available || true,
    config: {
      ...params,
      outputCredits: breakdown.outputCredits,
    },
    pricingNote: formatGeminiVideoPricingNote(breakdown),
    source: "estimate",
  };
}

function quoteResultFromCached(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  cached: {
    totalCredits: number;
    config: Record<string, unknown>;
    scaled: boolean;
  },
): QuoteResult {
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
    available: true,
    config: cached.config,
    pricingNote: withMultiplierNote(
      cached.scaled ? "Local cost table (duration scaled)" : "Local cost table",
    ),
    source: "cache",
    cached: true,
  };
}

function quoteEstimateResult(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
  available: boolean,
): QuoteResult {
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

async function quoteFromCache(
  input: QuoteInput,
  mcpModel: string,
  mode: string,
  params: Record<string, unknown>,
): Promise<QuoteResult | null> {
  const mappedRes =
    typeof params.resolution === "string"
      ? params.resolution
      : mapResolutionForMcpModel(mcpModel, input.resolution);

  const cached = await lookupCachedCost({
    model: mcpModel,
    mode,
    resolution: mappedRes,
    duration: input.duration,
    generateAudio: input.generateAudio,
    aspectRatio: input.aspectRatio,
  });
  if (!cached) return null;
  return quoteResultFromCached(input, mcpModel, mode, cached);
}

/** Local pricing only — never dials OpenArt MCP. */
export async function quoteOpenArtCredits(
  input: QuoteInput,
  options: QuoteOptions = {},
): Promise<QuoteResult> {
  const allowCache = options.allowCache !== false;
  const catalog = getCatalogModel(input.modelId);
  const mcpModel = catalog ? resolveMcpModel(catalog) : input.modelId;
  const available = Boolean(catalog?.available && catalog.mcpId);
  const mode = resolveMode(catalog, input);
  const params = buildParams(input, mcpModel);

  // Veronix / BytePlus always use token formula — never OpenArt cache.
  const bytePlus = quoteBytePlusResult(input, mcpModel, mode, params, available);
  if (bytePlus) return bytePlus;

  // PixVerse direct API — official credit table × USD × 55% markup.
  const pixVerse = quotePixVerseResult(input, mcpModel, mode, params, available);
  if (pixVerse) return pixVerse;

  const miniMax = quoteMiniMaxH3Result(input, mcpModel, mode, params, available);
  if (miniMax) return miniMax;

  const kling = quoteKlingOmniResult(input, mcpModel, mode, params, available);
  if (kling) return kling;

  const flux = quoteFluxVideoResult(input, mcpModel, mode, params, available);
  if (flux) return flux;

  const gemini = quoteGeminiVideoResult(input, mcpModel, mode, params, available);
  if (gemini) return gemini;

  if (allowCache) {
    const fromCache = await quoteFromCache(input, mcpModel, mode, params);
    if (fromCache) {
      return { ...fromCache, available: available || fromCache.available };
    }
  }

  return quoteEstimateResult(input, mcpModel, mode, params, available);
}

export async function quoteMultipleModels(
  modelIds: string[],
  base: Omit<QuoteInput, "modelId">,
  options?: QuoteOptions,
): Promise<{ quotes: QuoteResult[]; totalCredits: number; multiplier: number }> {
  const unique = [...new Set(modelIds)].slice(0, 4);
  const quotes: QuoteResult[] = [];
  for (const modelId of unique) {
    quotes.push(await quoteOpenArtCredits({ ...base, modelId }, options));
  }
  const totalCredits = quotes.reduce((sum, q) => sum + q.totalCredits, 0);
  const multiplier = quotes[0]?.multiplier ?? VERONIX_CREDIT_MULTIPLIER;
  return { quotes, totalCredits, multiplier };
}

/** All live catalog models that must always go through pricing. */
export function listPricedCatalogModels() {
  return getActiveCatalog().all.filter((m) => m.available && m.mcpId);
}
