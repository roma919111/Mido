/**
 * Central wallet credit pricing for video generation models.
 *
 * Currency standard:
 *   $1.00 USD = 1,000 credits
 *   1 credit   = $0.001 USD
 */

import { PIXVERSE_MODEL_ID } from "@/lib/pixverse-constants";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import { SEEDANCE_2_MODEL_ID } from "@/lib/byteplus-constants";
import { MINIMAX_H3_MODEL_ID, MINIMAX_H3_OUTPUT_USD_PER_SEC } from "@/lib/minimax-constants";
import { GEMINI_OMNI_FLASH_MODEL_ID, GEMINI_VIDEO_USD_PER_SEC } from "@/lib/gemini-constants";
import {
  bytePlusCostUsd,
  estimateBytePlusTokens,
  normalizeVideoResolution,
  VERONIX_PROFIT_MARKUP,
  withProfitMarkup,
} from "@/lib/byteplus-pricing";

/** $1 USD → 1,000 wallet credits. */
export const CREDITS_PER_USD = 1_000;
/** 1 wallet credit = $0.001 USD. */
export const CREDIT_USD = 0.001;

export const INSUFFICIENT_CREDITS_ERROR = "Insufficient credit balance";

export type VideoQuality =
  | "360p"
  | "480p"
  | "540p"
  | "720p"
  | "768p"
  | "1080p"
  | "2k";

export type VideoTierRates = {
  noAudio: number;
  withAudio: number;
};

export type VideoModelPricingConfig = {
  /** Catalog model id (e.g. pixverse-v6). */
  modelId: string;
  displayName: string;
  /** Wallet credits charged per second of output video. */
  creditsPerSecond: Partial<Record<VideoQuality, VideoTierRates>>;
  /**
   * Optional Fusion / video-reference surcharge (credits per second).
   * Added on top of the clarity + audio tier when reference videos are attached.
   */
  videoReferenceExtraPerSecond?: Partial<Record<VideoQuality, number>>;
};

/** Veronix (Seedance) — BytePlus cost × 1.55 → wallet credits at {@link CREDIT_USD}. */
function veronixCreditsPerSecond(resolution: "480p" | "720p"): number {
  const durationSec = 5;
  const tokens = estimateBytePlusTokens(durationSec, resolution);
  const sellUsd = withProfitMarkup(bytePlusCostUsd(tokens));
  const total = Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
  return Math.max(1, Math.ceil(total / durationSec));
}

const VERONIX_480_PER_SEC = veronixCreditsPerSecond("480p");
const VERONIX_720_PER_SEC = veronixCreditsPerSecond("720p");
/** Seedance 2.0 full — ~2× mini (OpenArt list cost reference). */
const SEEDANCE_2_480_PER_SEC = Math.max(1, VERONIX_480_PER_SEC * 2);
const SEEDANCE_2_720_PER_SEC = Math.max(1, VERONIX_720_PER_SEC * 2);

function listCostToCreditsPerSecond(costUsdPerSec: number): number {
  return Math.max(
    1,
    Math.ceil((costUsdPerSec * VERONIX_PROFIT_MARKUP) / CREDIT_USD),
  );
}

const MINIMAX_768_PER_SEC = listCostToCreditsPerSecond(
  MINIMAX_H3_OUTPUT_USD_PER_SEC["768p"],
);
const MINIMAX_2K_PER_SEC = listCostToCreditsPerSecond(
  MINIMAX_H3_OUTPUT_USD_PER_SEC["2k"],
);
const GEMINI_OMNI_PER_SEC = listCostToCreditsPerSecond(GEMINI_VIDEO_USD_PER_SEC);

/**
 * Per-model video pricing table.
 * Add future models (Kling, Luma, PixVerse V5.6, …) with the same shape.
 */
export const VIDEO_MODEL_PRICING: Record<string, VideoModelPricingConfig> = {
  [PIXVERSE_MODEL_ID]: {
    modelId: PIXVERSE_MODEL_ID,
    displayName: "PixVerse V6",
    creditsPerSecond: {
      "360p": { noAudio: 35, withAudio: 48 },
      "540p": { noAudio: 48, withAudio: 62 },
      "720p": { noAudio: 62, withAudio: 83 },
      "1080p": { noAudio: 124, withAudio: 158 },
    },
    videoReferenceExtraPerSecond: {
      "360p": 35,
      "540p": 49,
      "720p": 63,
      "1080p": 126,
    },
  },
  [VERONIX_MODEL_ID]: {
    modelId: VERONIX_MODEL_ID,
    displayName: "VYRONIX",
    creditsPerSecond: {
      "480p": { noAudio: VERONIX_480_PER_SEC, withAudio: VERONIX_480_PER_SEC },
      "720p": { noAudio: VERONIX_720_PER_SEC, withAudio: VERONIX_720_PER_SEC },
    },
  },
  [SEEDANCE_2_MODEL_ID]: {
    modelId: SEEDANCE_2_MODEL_ID,
    displayName: "Seedance 2.0",
    creditsPerSecond: {
      "480p": { noAudio: SEEDANCE_2_480_PER_SEC, withAudio: SEEDANCE_2_480_PER_SEC },
      "720p": { noAudio: SEEDANCE_2_720_PER_SEC, withAudio: SEEDANCE_2_720_PER_SEC },
    },
    videoReferenceExtraPerSecond: {
      "480p": SEEDANCE_2_480_PER_SEC,
      "720p": SEEDANCE_2_720_PER_SEC,
    },
  },
  [MINIMAX_H3_MODEL_ID]: {
    modelId: MINIMAX_H3_MODEL_ID,
    displayName: "MiniMax H3",
    creditsPerSecond: {
      "768p": { noAudio: MINIMAX_768_PER_SEC, withAudio: MINIMAX_768_PER_SEC },
      "2k": { noAudio: MINIMAX_2K_PER_SEC, withAudio: MINIMAX_2K_PER_SEC },
    },
  },
  [GEMINI_OMNI_FLASH_MODEL_ID]: {
    modelId: GEMINI_OMNI_FLASH_MODEL_ID,
    displayName: "Gemini Omni Flash",
    creditsPerSecond: {
      "720p": { noAudio: GEMINI_OMNI_PER_SEC, withAudio: GEMINI_OMNI_PER_SEC },
    },
  },
};

export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.ceil(usd * CREDITS_PER_USD);
}

export function creditsToUsd(credits: number): number {
  return credits * CREDIT_USD;
}

export function normalizeModelPricingId(model?: string | null): string {
  const id = String(model || "").trim().toLowerCase();
  if (id === "veronix" || id === "vyronix") return VERONIX_MODEL_ID;
  if (id === SEEDANCE_2_MODEL_ID || id === "seedance-2") return SEEDANCE_2_MODEL_ID;
  if (id === "pixverse-v6" || id.includes("pixverse")) return PIXVERSE_MODEL_ID;
  if (id === MINIMAX_H3_MODEL_ID || id.includes("minimax")) return MINIMAX_H3_MODEL_ID;
  if (id === GEMINI_OMNI_FLASH_MODEL_ID || id.includes("gemini-omni")) {
    return GEMINI_OMNI_FLASH_MODEL_ID;
  }
  return id;
}

export function normalizePricingQuality(
  resolution?: string | null,
  modelId?: string | null,
): VideoQuality {
  const r = String(resolution || "720p").trim().toLowerCase();
  const model = normalizeModelPricingId(modelId);

  if (model === PIXVERSE_MODEL_ID || model.includes("pixverse")) {
    if (r === "360p" || r.includes("360")) return "360p";
    if (r === "540p" || r.includes("540")) return "540p";
    if (r === "720p" || r.includes("720")) return "720p";
    if (r === "1080p" || r.includes("1080") || r === "1k" || r === "pro") {
      return "1080p";
    }
    if (r.includes("480") || r === "std") return "360p";
    return "540p";
  }

  if (model === MINIMAX_H3_MODEL_ID || model.includes("minimax")) {
    if (r === "2k" || r.includes("2k") || r.includes("1440") || r.includes("2160")) {
      return "2k";
    }
    return "768p";
  }

  const veronix = normalizeVideoResolution(resolution);
  return veronix === "480p" ? "480p" : "720p";
}

export function getModelPricing(
  model?: string | null,
): VideoModelPricingConfig | undefined {
  const key = normalizeModelPricingId(model);
  return VIDEO_MODEL_PRICING[key];
}

export function getVideoCreditsPerSecond(input: {
  model: string;
  quality?: string | null;
  hasAudio?: boolean;
  hasVideoReferences?: boolean;
}): number {
  const modelKey = normalizeModelPricingId(input.model);
  const pricing = getModelPricing(modelKey);
  const quality = normalizePricingQuality(input.quality, modelKey);

  if (!pricing) return 0;

  const tier = pricing.creditsPerSecond[quality];
  if (!tier) {
    const fallback =
      pricing.creditsPerSecond["720p"] ||
      pricing.creditsPerSecond["540p"] ||
      Object.values(pricing.creditsPerSecond)[0];
    if (!fallback) return 0;
    let perSec = input.hasAudio ? fallback.withAudio : fallback.noAudio;
    if (input.hasVideoReferences && pricing.videoReferenceExtraPerSecond) {
      const extra =
        pricing.videoReferenceExtraPerSecond[quality] ??
        Object.values(pricing.videoReferenceExtraPerSecond)[0] ??
        0;
      perSec += extra;
    }
    return perSec;
  }

  let perSec = input.hasAudio ? tier.withAudio : tier.noAudio;
  if (input.hasVideoReferences && pricing.videoReferenceExtraPerSecond) {
    perSec += pricing.videoReferenceExtraPerSecond[quality] ?? 0;
  }
  return perSec;
}

export type CalculateVideoCreditsInput = {
  model: string;
  quality?: string | null;
  hasAudio?: boolean;
  durationInSeconds: number;
  hasVideoReferences?: boolean;
  videoCount?: number;
};

/**
 * Wallet debit for a video clip.
 * Retrieves creditsPerSecond from {@link VIDEO_MODEL_PRICING} and returns
 * Math.ceil(rate × duration).
 */
export function calculateVideoCredits(input: CalculateVideoCreditsInput): number {
  const duration = Math.max(1, Math.round(Number(input.durationInSeconds) || 1));
  const count = Math.max(1, Math.round(input.videoCount ?? 1) || 1);
  const perSec = getVideoCreditsPerSecond({
    model: input.model,
    quality: input.quality,
    hasAudio: input.hasAudio,
    hasVideoReferences: input.hasVideoReferences,
  });

  if (perSec <= 0) return 1;

  return Math.max(1, Math.ceil(perSec * duration * count));
}

export function listVideoModelPricing(): VideoModelPricingConfig[] {
  const seen = new Set<string>();
  return Object.values(VIDEO_MODEL_PRICING).filter((entry) => {
    if (seen.has(entry.modelId)) return false;
    seen.add(entry.modelId);
    return true;
  });
}

export type CreditBalanceCheck =
  | { ok: true; requiredCredits: number }
  | {
      ok: false;
      error: typeof INSUFFICIENT_CREDITS_ERROR;
      requiredCredits: number;
      balance: number;
    };

/** Pre-flight wallet check before dispatching a generation job. */
export function checkSufficientCredits(
  balance: number,
  requiredCredits: number,
): CreditBalanceCheck {
  const required = Math.max(0, Math.round(requiredCredits));
  if (balance >= required) {
    return { ok: true, requiredCredits: required };
  }
  return {
    ok: false,
    error: INSUFFICIENT_CREDITS_ERROR,
    requiredCredits: required,
    balance,
  };
}
