/**
 * Owner admin — provider cost vs customer sell price per model.
 */

import {
  CREDIT_USD,
  CREDITS_PER_USD,
  calculateVideoCredits,
  listVideoModelPricing,
  type VideoQuality,
} from "@/config/modelPricing";
import { quoteCreditsLocal, type QuoteInput } from "@/lib/credit-quote-local";
import {
  BYTEPLUS_IMAGE_COST_USD,
  BYTEPLUS_TOKEN_USD_PER_1K,
  VERONIX_PROFIT_MARKUP,
  bytePlusCostUsd,
  estimateBytePlusTokens,
  estimateSeedance2Tokens,
  isVeronixImageModel,
  isVeronixVideoModel,
  quoteVeronixImageCredits,
} from "@/lib/byteplus-pricing";
import { SEEDANCE_2_MODEL_ID } from "@/lib/byteplus-constants";
import { getActiveCatalog, getCatalogModel } from "@/lib/model-catalog";
import { OPENART_COST_DEFAULTS } from "@/lib/openart-cost-defaults";
import { PIXVERSE_MODEL_ID, PIXVERSE_USD_PER_API_CREDIT } from "@/lib/pixverse-constants";
import { MINIMAX_H3_MODEL_ID } from "@/lib/minimax-constants";
import { VERONIX_CREDIT_MULTIPLIER } from "@/lib/credit-multiplier";
import {
  isGeminiOmniFlashModel,
  quoteGeminiVideoBreakdown,
} from "@/lib/gemini-pricing";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import {
  isMiniMaxH3Model,
  quoteMiniMaxH3VideoBreakdown,
  usesMiniMaxVideoBackend,
} from "@/lib/minimax-pricing";
import {
  isKlingOmniModel,
  quoteKlingOmniVideoBreakdown,
} from "@/lib/kling-pricing";
import {
  isFluxVideoModel,
  quoteFluxVideoBreakdown,
} from "@/lib/flux-pricing";
import {
  isPixVerseModel,
  quotePixVerseVideoBreakdown,
} from "@/lib/pixverse-pricing";

/** OpenArt platform credits ≈ $0.001 each (audit estimate for MCP-backed models). */
export const OPENART_PROVIDER_USD_PER_CREDIT = 0.001;

export type AdminEconomicsRow = {
  modelId: string;
  modelName: string;
  media: "image" | "video";
  scenario: string;
  walletCredits: number;
  costUsd: number;
  sellUsd: number;
  profitUsd: number;
  marginPct: number;
  providerNote: string;
};

function economicsRow(input: {
  modelId: string;
  modelName: string;
  media: "image" | "video";
  scenario: string;
  walletCredits: number;
  costUsd: number;
  providerNote: string;
}): AdminEconomicsRow {
  const sellUsd = input.walletCredits * CREDIT_USD;
  const profitUsd = sellUsd - input.costUsd;
  const marginPct = sellUsd > 0 ? (profitUsd / sellUsd) * 100 : 0;
  return {
    ...input,
    sellUsd,
    profitUsd,
    marginPct,
  };
}

function inferProviderCostUsd(input: QuoteInput, walletCredits: number): {
  costUsd: number;
  note: string;
} {
  const catalog = getCatalogModel(input.modelId);
  const mcpModel = catalog?.mcpId || input.modelId;

  if (input.media === "image" && isVeronixImageModel(input.modelId, mcpModel)) {
    const count = input.imageCount ?? 1;
    return {
      costUsd: BYTEPLUS_IMAGE_COST_USD * count,
      note: `BytePlus $${BYTEPLUS_IMAGE_COST_USD}/صورة`,
    };
  }

  if (input.media === "video" && isVeronixVideoModel(input.modelId, mcpModel)) {
    const duration = input.duration ?? 5;
    const resolution = input.resolution ?? "720p";
    const tokens = estimateBytePlusTokens(duration, resolution, input.videoCount ?? 1);
    let costUsd = bytePlusCostUsd(tokens);
    if (input.modelId === SEEDANCE_2_MODEL_ID) {
      const tokens = estimateSeedance2Tokens(duration, resolution, input.videoCount ?? 1);
      return {
        costUsd: bytePlusCostUsd(tokens),
        note: `Seedance 2.0 · ${resolution} · BytePlus tokens`,
      };
    }
    return {
      costUsd,
      note: `BytePlus pack ~$${BYTEPLUS_TOKEN_USD_PER_1K.toFixed(4)}/1K tokens`,
    };
  }

  if (input.media === "video" && isPixVerseModel(input.modelId, mcpModel)) {
    const breakdown = quotePixVerseVideoBreakdown({
      duration: input.duration,
      resolution: input.resolution,
      generateAudio: input.generateAudio,
      hasVideoReferences: input.hasVideoReferences,
      videoCount: input.videoCount,
    });
    return {
      costUsd: breakdown.costUsd,
      note: `PixVerse API ${breakdown.apiCredits} cr × $${PIXVERSE_USD_PER_API_CREDIT.toFixed(3)} × ${VERONIX_PROFIT_MARKUP}`,
    };
  }

  if (input.media === "video" && usesMiniMaxVideoBackend(input.modelId, mcpModel)) {
    const breakdown = quoteMiniMaxH3VideoBreakdown({
      duration: input.duration,
      resolution: input.resolution,
      referenceImageCount: input.referenceImageCount,
      referenceVideoDurationSec: input.referenceVideoDurationSec,
      videoCount: input.videoCount,
    });
    return {
      costUsd: breakdown.costUsd,
      note:
        input.modelId === VERONIX_MODEL_ID
          ? "VYRONIX (MiniMax H3) list USD × duration"
          : "MiniMax list USD × duration",
    };
  }

  if (input.media === "video" && isGeminiOmniFlashModel(input.modelId, mcpModel)) {
    const breakdown = quoteGeminiVideoBreakdown({
      duration: input.duration,
      videoCount: input.videoCount,
    });
    return {
      costUsd: breakdown.costUsd,
      note: "Gemini list USD × duration",
    };
  }

  if (input.media === "video" && isKlingOmniModel(input.modelId, mcpModel)) {
    const breakdown = quoteKlingOmniVideoBreakdown({
      duration: input.duration,
      resolution: input.resolution,
      generateAudio: input.generateAudio,
      videoCount: input.videoCount,
    });
    return {
      costUsd: breakdown.costUsd,
      note: "Kling list USD × duration",
    };
  }

  if (input.media === "video" && isFluxVideoModel(input.modelId, mcpModel)) {
    const breakdown = quoteFluxVideoBreakdown({
      duration: input.duration,
      resolution: input.resolution,
      hasVideoReferences: input.hasVideoReferences,
      videoCount: input.videoCount,
    });
    return {
      costUsd: breakdown.costUsd,
      note: `BFL FLUX 3 ${breakdown.mode} list USD × duration`,
    };
  }

  const quote = quoteCreditsLocal(input);
  return {
    costUsd: quote.openArtCredits * OPENART_PROVIDER_USD_PER_CREDIT,
    note: `OpenArt ${quote.openArtCredits} cr × $${OPENART_PROVIDER_USD_PER_CREDIT} · sell ×${VERONIX_CREDIT_MULTIPLIER}`,
  };
}

function rowFromQuote(input: QuoteInput, scenario: string): AdminEconomicsRow {
  const quote = quoteCreditsLocal(input);
  const catalog = getCatalogModel(input.modelId);
  const { costUsd, note } = inferProviderCostUsd(input, quote.totalCredits);
  return economicsRow({
    modelId: input.modelId,
    modelName: catalog?.name || input.modelId,
    media: input.media,
    scenario,
    walletCredits: quote.totalCredits,
    costUsd,
    providerNote: note,
  });
}

/** Detailed per-quality rows for centrally configured video models. */
function centralVideoPricingRows(): AdminEconomicsRow[] {
  const rows: AdminEconomicsRow[] = [];
  const duration = 5;

  for (const model of listVideoModelPricing()) {
    const qualities = Object.keys(model.creditsPerSecond) as VideoQuality[];
    for (const quality of qualities) {
      const tier = model.creditsPerSecond[quality];
      if (!tier) continue;
      for (const audio of [false, true] as const) {
        if (model.modelId === MINIMAX_H3_MODEL_ID && audio) continue;
        const walletCredits = calculateVideoCredits({
          model: model.modelId,
          quality,
          hasAudio: audio,
          durationInSeconds: duration,
        });
        const input: QuoteInput = {
          modelId: model.modelId,
          media: "video",
          mode: "text2video",
          duration,
          resolution: quality,
          generateAudio: audio,
        };
        const { costUsd, note } = inferProviderCostUsd(input, walletCredits);
        rows.push(
          economicsRow({
            modelId: model.modelId,
            modelName: model.displayName,
            media: "video",
            scenario: `${quality} · ${duration}s${audio ? " · صوت" : ""}`,
            walletCredits,
            costUsd,
            providerNote: note,
          }),
        );
      }
    }
  }

  return rows;
}

/** Live catalog models — standard 5s / default resolution scenarios. */
function catalogScenarioRows(): AdminEconomicsRow[] {
  const rows: AdminEconomicsRow[] = [];
  const catalog = getActiveCatalog().all.filter((m) => m.available && m.mcpId);

  for (const model of catalog) {
    if (model.kind === "image") {
      rows.push(
        rowFromQuote(
          {
            modelId: model.id,
            media: "image",
            mode: "text2image",
            imageCount: 1,
            aspectRatio: "4:3",
            resolution: "2K",
          },
          "صورة واحدة · text2image",
        ),
      );
      continue;
    }

    const duration = model.id.includes("gemini") ? 5 : 5;
    const resolution = model.resolutionDefault || "720p";
    rows.push(
      rowFromQuote(
        {
          modelId: model.id,
          media: "video",
          mode: "text2video",
          duration,
          resolution,
          generateAudio: false,
          aspectRatio: "16:9",
        },
        `${duration}s · ${resolution} · بدون صوت`,
      ),
    );

    if (
      model.id === "kling-3-omni" ||
      model.mcpId === PIXVERSE_MODEL_ID ||
      model.id === PIXVERSE_MODEL_ID
    ) {
      rows.push(
        rowFromQuote(
          {
            modelId: model.id,
            media: "video",
            mode: "text2video",
            duration,
            resolution,
            generateAudio: true,
            aspectRatio: "16:9",
          },
          `${duration}s · ${resolution} · مع صوت`,
        ),
      );
    }

    if (model.id === PIXVERSE_MODEL_ID || model.mcpId === PIXVERSE_MODEL_ID) {
      rows.push(
        rowFromQuote(
          {
            modelId: model.id,
            media: "video",
            mode: "fusion",
            duration,
            resolution,
            generateAudio: false,
            hasVideoReferences: true,
            aspectRatio: "16:9",
          },
          `${duration}s · ${resolution} · فيديو مرجعي`,
        ),
      );
      rows.push(
        rowFromQuote(
          {
            modelId: model.id,
            media: "video",
            mode: "fusion",
            duration,
            resolution,
            generateAudio: true,
            hasVideoReferences: true,
            aspectRatio: "16:9",
          },
          `${duration}s · ${resolution} · فيديو مرجعي + صوت`,
        ),
      );
    }
  }

  return rows;
}

/** Seeded OpenArt cost table — extra reference rows not covered above. */
function openArtDefaultRows(): AdminEconomicsRow[] {
  const seen = new Set<string>();
  const rows: AdminEconomicsRow[] = [];

  for (const item of OPENART_COST_DEFAULTS) {
    const catalog = getActiveCatalog().all.find((m) => m.mcpId === item.model);
    const modelId = catalog?.id || item.model;
    const modelName = catalog?.name || item.model;
    const media = item.mediaType === "image" ? "image" : "video";
    const cfg = item.config;
    const duration = typeof cfg.duration === "number" ? cfg.duration : undefined;
    const resolution =
      typeof cfg.resolution === "string" ? cfg.resolution : undefined;
    const audio = Boolean(cfg.generateAudio ?? cfg.generateSound);
    const key = `${item.model}|${item.mode}|${resolution}|${duration}|${audio}|${media}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const walletCredits = Math.max(
      1,
      Math.round(item.totalCredits * VERONIX_CREDIT_MULTIPLIER),
    );
    const costUsd = item.totalCredits * OPENART_PROVIDER_USD_PER_CREDIT;
    const scenarioParts = [
      item.mode,
      resolution,
      duration ? `${duration}s` : null,
      audio ? "صوت" : null,
    ].filter(Boolean);

    rows.push(
      economicsRow({
        modelId,
        modelName,
        media,
        scenario: scenarioParts.join(" · ") || item.mode,
        walletCredits,
        costUsd,
        providerNote: `OpenArt ${item.totalCredits} cr · ×${VERONIX_CREDIT_MULTIPLIER} → محفظة`,
      }),
    );
  }

  return rows;
}

/** Vyronix image standalone row (BytePlus). */
function vyronixImageRow(): AdminEconomicsRow {
  const walletCredits = quoteVeronixImageCredits(1);
  const costUsd = BYTEPLUS_IMAGE_COST_USD;
  return economicsRow({
    modelId: "vyronix-image",
    modelName: "VYRONIX Image",
    media: "image",
    scenario: "صورة واحدة",
    walletCredits,
    costUsd,
    providerNote: `$${BYTEPLUS_IMAGE_COST_USD} × ${VERONIX_PROFIT_MARKUP} markup`,
  });
}

export function buildAdminModelEconomics(): AdminEconomicsRow[] {
  const byKey = new Map<string, AdminEconomicsRow>();

  const merge = (row: AdminEconomicsRow) => {
    const key = `${row.modelId}|${row.media}|${row.scenario}`;
    if (!byKey.has(key)) byKey.set(key, row);
  };

  merge(vyronixImageRow());
  for (const row of centralVideoPricingRows()) merge(row);
  for (const row of catalogScenarioRows()) merge(row);
  for (const row of openArtDefaultRows()) merge(row);

  return [...byKey.values()].sort((a, b) => {
    const name = a.modelName.localeCompare(b.modelName, "ar");
    if (name !== 0) return name;
    return a.scenario.localeCompare(b.scenario, "ar");
  });
}

export function adminEconomicsSummary(rows: AdminEconomicsRow[]) {
  const avgMargin =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.marginPct, 0) / rows.length
      : 0;
  return {
    modelCount: new Set(rows.map((r) => r.modelId)).size,
    rowCount: rows.length,
    avgMarginPct: avgMargin,
    creditsPerUsd: CREDITS_PER_USD,
    creditUsd: CREDIT_USD,
    profitMarkup: VERONIX_PROFIT_MARKUP,
    openArtMultiplier: VERONIX_CREDIT_MULTIPLIER,
  };
}
