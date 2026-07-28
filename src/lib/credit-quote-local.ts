/**
 * Client-safe credit pricing (no node:fs).
 * Same seeded table ×1.8 as the server — used for instant UI display only.
 * Real wallet debit happens in /api/generate.
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

/**
 * Instant UI pricing from the seeded cost table (no network / no node:fs).
 */
export function quoteCreditsLocal(input: QuoteInput): QuoteResult {
  const catalog = getCatalogModel(input.modelId);
  const mcpModel = catalog ? resolveMcpModel(catalog) : input.modelId;
  const available = Boolean(catalog?.available && catalog.mcpId);
  const mode = resolveMode(catalog, input);
  const params = buildParams(input, mcpModel);
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

export type { QuoteInput, QuoteResult };
