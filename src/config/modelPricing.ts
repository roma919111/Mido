/**
 * Central wallet credit pricing for video generation models.
 *
 * Currency standard:
 *   $1.00 USD = 1,000 credits
 *   1 credit   = $0.001 USD
 */

import {
  PIXVERSE_API_CREDITS_PER_SEC,
  PIXVERSE_MODEL_ID,
  PIXVERSE_USD_PER_API_CREDIT,
} from "@/lib/pixverse-constants";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import { SEEDANCE_2_MODEL_ID, SEEDANCE_MINI_MODEL_ID } from "@/lib/byteplus-constants";
import { MINIMAX_H3_MODEL_ID, MINIMAX_H3_OUTPUT_USD_PER_SEC } from "@/lib/minimax-constants";
import {
  KLING_OMNI_MODEL_ID,
  KLING_OMNI_OUTPUT_USD_PER_SEC,
} from "@/lib/kling-constants";
import {
  FLUX_VIDEO_MODEL_ID,
  FLUX_VIDEO_USD_PER_SEC,
} from "@/lib/flux-constants";
import { GEMINI_OMNI_FLASH_MODEL_ID, GEMINI_VIDEO_USD_PER_SEC } from "@/lib/gemini-constants";
import {
  bytePlusCostUsd,
  estimateBytePlusTokens,
  estimateSeedance2Tokens,
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
  | "2k"
  | "4k"
  | "draft"
  | "hd"
  | "fhd";

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
  /**
   * Full Fusion (video-reference) wallet rates — replaces the base tier.
   * PixVerse V6 official table is ~2× when video_references are attached.
   */
  videoReferenceCreditsPerSecond?: Partial<Record<VideoQuality, VideoTierRates>>;
};

/** Veronix (Seedance) — BytePlus cost × 1.55 → wallet credits at {@link CREDIT_USD}. */
function veronixCreditsPerSecond(resolution: "480p" | "720p"): number {
  const durationSec = 5;
  const tokens = estimateBytePlusTokens(durationSec, resolution);
  const sellUsd = withProfitMarkup(bytePlusCostUsd(tokens));
  const total = Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
  return Math.max(1, Math.ceil(total / durationSec));
}

/** Seedance 2.0 — BytePlus tokens (incl. 1080p / 4K) × 1.55 → credits/s. */
function seedance2CreditsPerSecond(
  resolution: "480p" | "720p" | "1080p" | "4k",
): number {
  const durationSec = 5;
  const tokens = estimateSeedance2Tokens(durationSec, resolution);
  const sellUsd = withProfitMarkup(bytePlusCostUsd(tokens));
  const total = Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
  return Math.max(1, Math.ceil(total / durationSec));
}

const VERONIX_480_PER_SEC = veronixCreditsPerSecond("480p");
const VERONIX_720_PER_SEC = veronixCreditsPerSecond("720p");
/** Seedance 2.0 full — ~2× mini (OpenArt list cost reference). */
const SEEDANCE_2_480_PER_SEC = seedance2CreditsPerSecond("480p");
const SEEDANCE_2_720_PER_SEC = seedance2CreditsPerSecond("720p");
const SEEDANCE_2_1080_PER_SEC = seedance2CreditsPerSecond("1080p");
const SEEDANCE_2_4K_PER_SEC = seedance2CreditsPerSecond("4k");

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

function klingOmniTierRates(quality: keyof typeof KLING_OMNI_OUTPUT_USD_PER_SEC): {
  noAudio: number;
  withAudio: number;
} {
  const tier = KLING_OMNI_OUTPUT_USD_PER_SEC[quality];
  return {
    noAudio: listCostToCreditsPerSecond(tier.noAudio),
    withAudio: listCostToCreditsPerSecond(tier.withAudio),
  };
}

function pixverseWalletPerApiCredit(apiCreditsPerSec: number): number {
  return Math.max(
    1,
    Math.ceil(
      (apiCreditsPerSec * PIXVERSE_USD_PER_API_CREDIT * VERONIX_PROFIT_MARKUP) /
        CREDIT_USD,
    ),
  );
}

function pixverseTierFromApi(
  quality: keyof typeof PIXVERSE_API_CREDITS_PER_SEC,
): { base: VideoTierRates; fusion: VideoTierRates } {
  const api = PIXVERSE_API_CREDITS_PER_SEC[quality];
  return {
    base: {
      noAudio: pixverseWalletPerApiCredit(api.noAudio),
      withAudio: pixverseWalletPerApiCredit(api.withAudio),
    },
    fusion: {
      noAudio: pixverseWalletPerApiCredit(api.noAudioVideoRef),
      withAudio: pixverseWalletPerApiCredit(api.withAudioVideoRef),
    },
  };
}

const PIXVERSE_360 = pixverseTierFromApi("360p");
const PIXVERSE_540 = pixverseTierFromApi("540p");
const PIXVERSE_720 = pixverseTierFromApi("720p");
const PIXVERSE_1080 = pixverseTierFromApi("1080p");

function fluxTierRates(quality: keyof typeof FLUX_VIDEO_USD_PER_SEC.t2v): {
  noAudio: number;
  withAudio: number;
} {
  const perSec = listCostToCreditsPerSecond(FLUX_VIDEO_USD_PER_SEC.t2v[quality]);
  return { noAudio: perSec, withAudio: perSec };
}

/**
 * Per-model video pricing table.
 * Add future models (Kling, Luma, PixVerse V5.6, …) with the same shape.
 */
export const VIDEO_MODEL_PRICING: Record<string, VideoModelPricingConfig> = {
  [PIXVERSE_MODEL_ID]: {
    modelId: PIXVERSE_MODEL_ID,
    displayName: "PixVerse V6",
    creditsPerSecond: {
      "360p": PIXVERSE_360.base,
      "540p": PIXVERSE_540.base,
      "720p": PIXVERSE_720.base,
      "1080p": PIXVERSE_1080.base,
    },
    videoReferenceCreditsPerSecond: {
      "360p": PIXVERSE_360.fusion,
      "540p": PIXVERSE_540.fusion,
      "720p": PIXVERSE_720.fusion,
      "1080p": PIXVERSE_1080.fusion,
    },
  },
  [VERONIX_MODEL_ID]: {
    modelId: VERONIX_MODEL_ID,
    displayName: "VYRONIX",
    creditsPerSecond: {
      "768p": { noAudio: MINIMAX_768_PER_SEC, withAudio: MINIMAX_768_PER_SEC },
      "2k": { noAudio: MINIMAX_2K_PER_SEC, withAudio: MINIMAX_2K_PER_SEC },
    },
  },
  [SEEDANCE_MINI_MODEL_ID]: {
    modelId: SEEDANCE_MINI_MODEL_ID,
    displayName: "Seedance 2 Mini",
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
      "1080p": { noAudio: SEEDANCE_2_1080_PER_SEC, withAudio: SEEDANCE_2_1080_PER_SEC },
      "4k": { noAudio: SEEDANCE_2_4K_PER_SEC, withAudio: SEEDANCE_2_4K_PER_SEC },
    },
    videoReferenceExtraPerSecond: {
      "480p": SEEDANCE_2_480_PER_SEC,
      "720p": SEEDANCE_2_720_PER_SEC,
      "1080p": SEEDANCE_2_1080_PER_SEC,
      "4k": SEEDANCE_2_4K_PER_SEC,
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
  [KLING_OMNI_MODEL_ID]: {
    modelId: KLING_OMNI_MODEL_ID,
    displayName: "Kling 3.0 Omni",
    creditsPerSecond: {
      "720p": klingOmniTierRates("720p"),
      "1080p": klingOmniTierRates("1080p"),
      "4k": klingOmniTierRates("4k"),
    },
  },
  [FLUX_VIDEO_MODEL_ID]: {
    modelId: FLUX_VIDEO_MODEL_ID,
    displayName: "FLUX 3",
    creditsPerSecond: {
      draft: fluxTierRates("draft"),
      hd: fluxTierRates("hd"),
      fhd: fluxTierRates("fhd"),
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
  if (id === SEEDANCE_MINI_MODEL_ID || id === "seedance-2-mini") {
    return SEEDANCE_MINI_MODEL_ID;
  }
  if (
    id === SEEDANCE_2_MODEL_ID ||
    id === "seedance-2" ||
    id === "seedance-2-fast"
  ) {
    return SEEDANCE_2_MODEL_ID;
  }
  if (id === "pixverse-v6" || id.includes("pixverse")) return PIXVERSE_MODEL_ID;
  if (id === MINIMAX_H3_MODEL_ID || id.includes("minimax-h3")) return MINIMAX_H3_MODEL_ID;
  if (id === GEMINI_OMNI_FLASH_MODEL_ID || id.includes("gemini-omni")) {
    return GEMINI_OMNI_FLASH_MODEL_ID;
  }
  if (id === KLING_OMNI_MODEL_ID || id.includes("kling-3-omni")) {
    return KLING_OMNI_MODEL_ID;
  }
  if (id === FLUX_VIDEO_MODEL_ID || id.includes("flux-3") || id === "flux") {
    return FLUX_VIDEO_MODEL_ID;
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

  if (model === MINIMAX_H3_MODEL_ID || model === VERONIX_MODEL_ID || model.includes("minimax-h3")) {
    if (r === "2k" || r.includes("2k") || r.includes("1440") || r.includes("2160")) {
      return "2k";
    }
    return "768p";
  }

  if (model === KLING_OMNI_MODEL_ID || model.includes("kling")) {
    if (r === "4k" || r.includes("2160")) return "4k";
    if (r === "1080p" || r.includes("1080") || r === "pro" || r === "1k") {
      return "1080p";
    }
    return "720p";
  }

  if (model === FLUX_VIDEO_MODEL_ID || model.includes("flux-3")) {
    if (r === "draft" || r.includes("draft") || r === "std") return "draft";
    if (r === "fhd" || r.includes("1080") || r.includes("1920") || r === "2k" || r === "pro") {
      return "fhd";
    }
    return "hd";
  }

  if (model === SEEDANCE_2_MODEL_ID || model === "seedance-2" || model === "seedance-2-fast") {
    if (r === "4k" || r.includes("2160")) return "4k";
    if (r === "1080p" || r.includes("1080") || r === "1k" || r === "pro") {
      return "1080p";
    }
    if (r.includes("480") || r === "std") return "480p";
    return "720p";
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

  if (input.hasVideoReferences && pricing.videoReferenceCreditsPerSecond) {
    const fusion =
      pricing.videoReferenceCreditsPerSecond[quality] ||
      Object.values(pricing.videoReferenceCreditsPerSecond)[0];
    if (fusion) {
      return input.hasAudio ? fusion.withAudio : fusion.noAudio;
    }
  }

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
