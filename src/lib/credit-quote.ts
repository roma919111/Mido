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
  const isVyronixImage =
    input.media === "image" &&
    (input.modelId === "vyronix-image" || mcpModel.includes("seedream"));
  const isVyronixVideo =
    input.media === "video" &&
    (input.modelId === "veronix" ||
      input.modelId === "seedance-2-mini" ||
      mcpModel.includes("seedance"));

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
      isVyronixImage
        ? "VYRONIX image studio (BytePlus)"
        : isVyronixVideo
          ? "VYRONIX video studio (BytePlus)"
          : available
            ? "Local estimate"
            : "Estimate for unavailable model",
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
  return { quotes, totalCredits, multiplier: VERONIX_CREDIT_MULTIPLIER };
}

/** All live catalog models that must always go through ×1.8. */
export function listPricedCatalogModels() {
  return getActiveCatalog().all.filter((m) => m.available && m.mcpId);
}
