/**
 * Veronix customer pricing from BytePlus token economics.
 *
 * Pack rate → token USD → sell = cost × markup → wallet credits.
 * Active config can be overridden at runtime (admin pack calculator).
 */

export type VeronixPricingConfig = {
  /** Prepaid pack price in USD (e.g. 29.4). */
  packUsd: number;
  /** Tokens included in that pack (e.g. 14_000_000). */
  packTokens: number;
  /** BytePlus image unit cost USD. */
  imageCostUsd: number;
  /** Model frame rate used in the token formula. */
  fps: number;
  /** Sell multiplier over cost (1.55 = +55%). */
  profitMarkup: number;
  /** Customer wallet unit in USD. */
  creditUsd: number;
};

export const DEFAULT_VERONIX_PRICING: VeronixPricingConfig = {
  packUsd: 29.4,
  packTokens: 14_000_000,
  imageCostUsd: 0.04,
  fps: 24,
  profitMarkup: 1.55,
  creditUsd: 0.0001,
};

/** @deprecated Prefer getActivePricingConfig().packUsd */
export const BYTEPLUS_PACK_USD = DEFAULT_VERONIX_PRICING.packUsd;
/** @deprecated Prefer getActivePricingConfig().packTokens */
export const BYTEPLUS_PACK_TOKENS = DEFAULT_VERONIX_PRICING.packTokens;
/** @deprecated Prefer tokenUsdPer1k(getActivePricingConfig()) */
export const BYTEPLUS_TOKEN_USD_PER_1K =
  (DEFAULT_VERONIX_PRICING.packUsd / DEFAULT_VERONIX_PRICING.packTokens) * 1000;
export const BYTEPLUS_IMAGE_COST_USD = DEFAULT_VERONIX_PRICING.imageCostUsd;
export const BYTEPLUS_FPS = DEFAULT_VERONIX_PRICING.fps;
export const VERONIX_PROFIT_MARKUP = DEFAULT_VERONIX_PRICING.profitMarkup;
export const VERONIX_CREDIT_USD = DEFAULT_VERONIX_PRICING.creditUsd;

export const VIDEO_RES_DIMS = {
  "480p": { width: 864, height: 480 },
  "720p": { width: 1280, height: 720 },
} as const;

export type VeronixVideoResolution = keyof typeof VIDEO_RES_DIMS;

let activePricing: VeronixPricingConfig = { ...DEFAULT_VERONIX_PRICING };

export function normalizePricingConfig(
  input?: Partial<VeronixPricingConfig> | null,
): VeronixPricingConfig {
  const packUsd = Number(input?.packUsd);
  const packTokens = Number(input?.packTokens);
  const imageCostUsd = Number(input?.imageCostUsd);
  const fps = Number(input?.fps);
  const profitMarkup = Number(input?.profitMarkup);
  const creditUsd = Number(input?.creditUsd);

  return {
    packUsd:
      Number.isFinite(packUsd) && packUsd > 0
        ? packUsd
        : DEFAULT_VERONIX_PRICING.packUsd,
    packTokens:
      Number.isFinite(packTokens) && packTokens >= 1000
        ? Math.round(packTokens)
        : DEFAULT_VERONIX_PRICING.packTokens,
    imageCostUsd:
      Number.isFinite(imageCostUsd) && imageCostUsd >= 0
        ? imageCostUsd
        : DEFAULT_VERONIX_PRICING.imageCostUsd,
    fps:
      Number.isFinite(fps) && fps > 0
        ? fps
        : DEFAULT_VERONIX_PRICING.fps,
    profitMarkup:
      Number.isFinite(profitMarkup) && profitMarkup >= 1
        ? profitMarkup
        : DEFAULT_VERONIX_PRICING.profitMarkup,
    creditUsd:
      Number.isFinite(creditUsd) && creditUsd > 0
        ? creditUsd
        : DEFAULT_VERONIX_PRICING.creditUsd,
  };
}

export function getActivePricingConfig(): VeronixPricingConfig {
  return activePricing;
}

export function setActivePricingConfig(
  input?: Partial<VeronixPricingConfig> | null,
): VeronixPricingConfig {
  activePricing = normalizePricingConfig(input);
  return activePricing;
}

export function tokenUsdPer1k(cfg: VeronixPricingConfig = activePricing): number {
  return (cfg.packUsd / cfg.packTokens) * 1000;
}

/** Only 480p / 720p — 1080p and 4K are clamped to 720p. */
export function normalizeVideoResolution(
  resolution?: string | null,
): VeronixVideoResolution {
  const r = String(resolution || "720p").trim().toLowerCase();
  if (r.includes("480") || r === "std") return "480p";
  return "720p";
}

export function clampVideoDurationSeconds(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(4, Math.min(15, Number.isFinite(n) ? n : 5));
}

/** BytePlus: tokens = (W × H × fps × duration) / 1024 × count */
export function estimateBytePlusTokens(
  durationSec: number,
  resolution?: string | null,
  videoCount = 1,
  cfg: VeronixPricingConfig = activePricing,
): number {
  const { width, height } = VIDEO_RES_DIMS[normalizeVideoResolution(resolution)];
  const duration = clampVideoDurationSeconds(durationSec);
  const count = Math.max(1, Math.round(videoCount) || 1);
  return ((width * height * cfg.fps * duration) / 1024) * count;
}

export function tokensPerSecond(
  resolution?: string | null,
  cfg: VeronixPricingConfig = activePricing,
): number {
  const { width, height } = VIDEO_RES_DIMS[normalizeVideoResolution(resolution)];
  return (width * height * cfg.fps) / 1024;
}

export function bytePlusCostUsd(
  tokens: number,
  cfg: VeronixPricingConfig = activePricing,
): number {
  return (tokens / 1000) * tokenUsdPer1k(cfg);
}

export function withProfitMarkup(
  costUsd: number,
  cfg: VeronixPricingConfig = activePricing,
): number {
  return costUsd * cfg.profitMarkup;
}

export function usdToVeronixCredits(
  sellUsd: number,
  cfg: VeronixPricingConfig = activePricing,
): number {
  if (!Number.isFinite(sellUsd) || sellUsd <= 0) return 1;
  return Math.max(1, Math.round(sellUsd / cfg.creditUsd));
}

export function quoteVeronixVideoCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  videoCount?: number;
  config?: VeronixPricingConfig;
}): number {
  const cfg = input.config || activePricing;
  const tokens = estimateBytePlusTokens(
    input.duration ?? 5,
    input.resolution,
    input.videoCount ?? 1,
    cfg,
  );
  return usdToVeronixCredits(withProfitMarkup(bytePlusCostUsd(tokens, cfg), cfg), cfg);
}

export function quoteVeronixImageCredits(
  imageCount = 1,
  cfg: VeronixPricingConfig = activePricing,
): number {
  const count = Math.max(1, Math.round(imageCount) || 1);
  return usdToVeronixCredits(
    withProfitMarkup(cfg.imageCostUsd * count, cfg),
    cfg,
  );
}

export type PricingTierRow = {
  id: string;
  label: string;
  kind: "video_per_sec" | "video_clip" | "image";
  resolution?: VeronixVideoResolution;
  durationSec?: number;
  tokens: number;
  costUsd: number;
  sellUsd: number;
  profitUsd: number;
  profitPct: number;
  credits: number;
};

/** Admin calculator rows — cost / sell / profit / customer credits. */
export function buildPricingBreakdown(
  cfg: VeronixPricingConfig = activePricing,
): PricingTierRow[] {
  const rows: PricingTierRow[] = [];
  const resolutions: VeronixVideoResolution[] = ["480p", "720p"];

  for (const resolution of resolutions) {
    const tokens = tokensPerSecond(resolution, cfg);
    const costUsd = bytePlusCostUsd(tokens, cfg);
    const sellUsd = withProfitMarkup(costUsd, cfg);
    const profitUsd = sellUsd - costUsd;
    rows.push({
      id: `video-sec-${resolution}`,
      label: `فيديو ${resolution} / ثانية`,
      kind: "video_per_sec",
      resolution,
      durationSec: 1,
      tokens,
      costUsd,
      sellUsd,
      profitUsd,
      profitPct: costUsd > 0 ? (profitUsd / costUsd) * 100 : 0,
      credits: usdToVeronixCredits(sellUsd, cfg),
    });
  }

  for (const resolution of resolutions) {
    for (const durationSec of [4, 5, 8, 10, 15] as const) {
      const tokens = estimateBytePlusTokens(durationSec, resolution, 1, cfg);
      const costUsd = bytePlusCostUsd(tokens, cfg);
      const sellUsd = withProfitMarkup(costUsd, cfg);
      const profitUsd = sellUsd - costUsd;
      rows.push({
        id: `video-${resolution}-${durationSec}s`,
        label: `فيديو ${resolution} · ${durationSec}ث`,
        kind: "video_clip",
        resolution,
        durationSec,
        tokens,
        costUsd,
        sellUsd,
        profitUsd,
        profitPct: costUsd > 0 ? (profitUsd / costUsd) * 100 : 0,
        credits: usdToVeronixCredits(sellUsd, cfg),
      });
    }
  }

  {
    const costUsd = cfg.imageCostUsd;
    const sellUsd = withProfitMarkup(costUsd, cfg);
    const profitUsd = sellUsd - costUsd;
    rows.push({
      id: "image-1",
      label: "صورة Veronix (1)",
      kind: "image",
      tokens: 0,
      costUsd,
      sellUsd,
      profitUsd,
      profitPct: costUsd > 0 ? (profitUsd / costUsd) * 100 : 0,
      credits: usdToVeronixCredits(sellUsd, cfg),
    });
  }

  return rows;
}

export function isVeronixVideoModel(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === "veronix" ||
    id === "seedance-2-mini" ||
    mcp.includes("seedance") ||
    mcp.includes("byte-plus-seedance")
  );
}

export function isVeronixImageModel(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return (
    id === "vyronix-image" ||
    mcp.includes("seedream") ||
    mcp.includes("byte-plus-seedream")
  );
}
