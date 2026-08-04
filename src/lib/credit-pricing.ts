import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_GENERATION_CREDITS,
  MODEL_PRICING,
  type VideoResolution,
} from "@/config/modelPricing";
import type { GenerationMode } from "@/lib/types";

export type CalculateVideoCreditsInput = {
  model?: string;
  resolution: VideoResolution;
  hasAudio: boolean;
  durationInSeconds: number;
};

export function getVideoCreditsPerSecond(
  model: string,
  resolution: VideoResolution,
  hasAudio: boolean,
): number {
  const entry = MODEL_PRICING[model];
  if (!entry) {
    throw new Error(`Unknown video model for pricing: ${model}`);
  }

  const tier = entry.video[resolution];
  if (!tier) {
    throw new Error(`Unknown resolution for ${model}: ${resolution}`);
  }

  return hasAudio ? tier.withAudio : tier.noAudio;
}

/**
 * Returns total credits for a video job: ceil(creditsPerSecond × duration).
 */
export function calculateVideoCredits(input: CalculateVideoCreditsInput): number {
  const model = input.model ?? DEFAULT_VIDEO_MODEL;
  const duration = Math.max(1, Math.round(input.durationInSeconds));
  const rate = getVideoCreditsPerSecond(model, input.resolution, input.hasAudio);
  return Math.ceil(rate * duration);
}

export function calculateImageCredits(): number {
  return IMAGE_GENERATION_CREDITS;
}

export function estimateGenerationCredits(input: {
  mode: GenerationMode;
  model?: string;
  resolution?: VideoResolution;
  hasAudio?: boolean;
  durationInSeconds?: number;
}): number {
  if (input.mode === "text-to-image") {
    return calculateImageCredits();
  }

  return calculateVideoCredits({
    model: input.model ?? DEFAULT_VIDEO_MODEL,
    resolution: input.resolution ?? "720p",
    hasAudio: Boolean(input.hasAudio),
    durationInSeconds: input.durationInSeconds ?? 5,
  });
}

export function isModelPricingSupported(model: string): boolean {
  return model in MODEL_PRICING;
}
