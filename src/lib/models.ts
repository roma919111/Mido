import type { GenerationMode, VideoDuration, VideoQuality } from "./types";

export const GEMINI_IMAGE_MODEL_ID = "gemini-2.5-flash-image";
export const GEMINI_VIDEO_MODEL_ID = "gemini-omni-flash-preview";

export const CREDIT_COSTS = {
  image: 15,
  video: {
    standard: { 5: 80, 10: 160 } as Record<VideoDuration, number>,
    pro: { 5: 80, 10: 160 } as Record<VideoDuration, number>,
  },
} as const;

export function estimateCredits(
  mode: GenerationMode,
  duration: VideoDuration = 5,
  quality: VideoQuality = "standard",
): number {
  if (mode === "text-to-image") return CREDIT_COSTS.image;
  return CREDIT_COSTS.video[quality][duration];
}

export function getModelLabel(mode: GenerationMode): string {
  if (mode === "text-to-image") return GEMINI_IMAGE_MODEL_ID;
  return GEMINI_VIDEO_MODEL_ID;
}
