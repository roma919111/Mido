import { callOpenArtTool, OpenArtConfigError, parseToolPayload } from "@/lib/openart-mcp";
import { getActiveCatalog, getCatalogModel, resolveMcpModel } from "@/lib/model-catalog";
import { audioParamForMcpModel, mapResolutionForMcpModel } from "@/lib/model-params";
import { lookupCachedCost } from "@/lib/openart-cost-cache";

/** Veronix wallet credits = OpenArt base credits × this fixed markup. */
export const VERONIX_CREDIT_MULTIPLIER = 1.8;

/** Apply the platform markup to every model — no per-model exceptions. */
export function toVeronixCredits(openArtCredits: number): number {
  const base = Number(openArtCredits);
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.max(1, Math.round(base * VERONIX_CREDIT_MULTIPLIER));
}

export function withMultiplierNote(note?: string): string {
  const base = note?.trim();
  const tag = `Veronix price = OpenArt × ${VERONIX_CREDIT_MULTIPLIER}`;
  if (!base) return tag;
  if (base.includes("× 1.8") || base.includes("×1.8") || base.includes(String(VERONIX_CREDIT_MULTIPLIER))) {
    return base;
  }
  return `${base} · ${tag}`;
}

export interface QuoteInput {
  modelId: string;
  media: "image" | "video";
  mode: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  imageCount?: number;
  videoCount?: number;
  generateAudio?: boolean;
}

export interface QuoteResult {
  modelId: string;
  mcpModel: string;
  mode: string;
  /** Final Veronix wallet debit (OpenArt × 1.8). */
  totalCredits: number;
  unitCredits: number;
  /** Raw OpenArt credits before markup (for audit / UI transparency). */
  openArtCredits: number;
  multiplier: number;
  available: boolean;
  config: Record<string, unknown>;
  pricingNote?: string;
  source: "openart" | "openart-cache" | "estimate";
  cached?: boolean;
}

export interface QuoteOptions {
  /** Allow seeded/synced OpenArt cost cache when owner MCP is offline (UI only). */
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
    // GPT Image uses resolutionTier + quality; others accept resolution / aspect only.
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
  // Models without a resolution control (e.g. Gemini) omit the field entirely.
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
      cached.scaled
        ? "Synced from OpenArt cost table (duration scaled)"
        : "Synced from OpenArt cost table",
    ),
    source: "openart-cache",
    cached: true,
  };
}

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

  if (!available) {
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
      available: false,
      config: params,
      pricingNote: withMultiplierNote("Estimate for unavailable model"),
      source: "estimate",
    };
  }

  try {
    const result = await callOpenArtTool("openart_model_cost", {
      model: mcpModel,
      mode,
      params,
    });
    const payload = parseToolPayload(result);
    if (result.isError) {
      throw new Error(String(payload.error || payload.rawText || "Cost lookup failed"));
    }

    const items = (payload.items as Array<Record<string, unknown>> | undefined) ?? [];
    const first = items[0] ?? payload;
    const openArtCredits = Number(first.totalCredits ?? first.unitCredits ?? 0);
    if (!Number.isFinite(openArtCredits) || openArtCredits <= 0) {
      throw new Error("Invalid credit quote from OpenArt");
    }

    const veronixCredits = toVeronixCredits(openArtCredits);
    const openArtUnit = Number(first.unitCredits ?? openArtCredits);
    return {
      modelId: input.modelId,
      mcpModel,
      mode,
      totalCredits: veronixCredits,
      unitCredits: toVeronixCredits(openArtUnit),
      openArtCredits,
      multiplier: VERONIX_CREDIT_MULTIPLIER,
      available: true,
      config: (first.config as Record<string, unknown>) ?? params,
      pricingNote: withMultiplierNote(
        typeof payload.pricingNote === "string" ? payload.pricingNote : undefined,
      ),
      source: "openart",
    };
  } catch (error) {
    if (allowCache) {
      const fromCache = await quoteFromCache(input, mcpModel, mode, params);
      if (fromCache) return fromCache;
    }

    // BytePlus Seedream (VYRONIX image): bill from defaults even if OpenArt MCP is offline.
    if (
      input.media === "image" &&
      (mcpModel.includes("seedream") || input.modelId === "vyronix-image")
    ) {
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
        available: true,
        config: params,
        pricingNote: withMultiplierNote("VYRONIX image studio (BytePlus)"),
        source: "estimate",
      };
    }

    const needsOwner =
      error instanceof OpenArtConfigError ||
      (error instanceof Error && /not connected|unauthorized|Reconnect/i.test(error.message));

    throw new Error(
      needsOwner
        ? `تعذر مزامنة التكلفة مؤقتًا. حاول مرة أخرى.`
        : error instanceof Error
          ? `تعذر مزامنة تكلفة Veronix للموديل ${catalog?.name || mcpModel}: ${error.message}`
          : `تعذر مزامنة تكلفة Veronix للموديل ${catalog?.name || mcpModel}`,
    );
  }
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
