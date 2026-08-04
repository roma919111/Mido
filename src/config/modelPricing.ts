/**
 * Central credit pricing configuration.
 * Currency: $1.00 USD = 1,000 credits (1 credit = $0.001 USD).
 */

export const CREDITS_PER_USD = 1_000;
export const USD_PER_CREDIT = 0.001;

/** Supported video output resolutions for per-second billing. */
export type VideoResolution = "360p" | "540p" | "720p" | "1080p";

export type VideoRateTier = {
  noAudio: number;
  withAudio: number;
};

export type ModelVideoPricing = Record<VideoResolution, VideoRateTier>;

export type ModelPricingEntry = {
  video: ModelVideoPricing;
};

/** Per-model video rates: credits per second. */
export const MODEL_PRICING: Record<string, ModelPricingEntry> = {
  pixverseV6: {
    video: {
      "360p": { noAudio: 35, withAudio: 48 },
      "540p": { noAudio: 48, withAudio: 62 },
      "720p": { noAudio: 62, withAudio: 83 },
      "1080p": { noAudio: 124, withAudio: 158 },
    },
  },
  // Future models — add with the same shape:
  // pixverseV5: { video: { ... } },
  // kling: { video: { ... } },
  // luma: { video: { ... } },
};

/** Flat credit cost for image generation (not per-second). */
export const IMAGE_GENERATION_CREDITS = 15;

export const DEFAULT_VIDEO_MODEL = "pixverseV6";

export const VIDEO_RESOLUTIONS: VideoResolution[] = ["360p", "540p", "720p", "1080p"];

export function creditsToUsd(credits: number): number {
  return credits * USD_PER_CREDIT;
}

export function usdToCredits(usd: number): number {
  return Math.ceil(usd * CREDITS_PER_USD);
}
