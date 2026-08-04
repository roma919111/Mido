import { DEFAULT_VIDEO_MODEL } from "@/config/modelPricing";
import {
  calculateImageCredits,
  calculateVideoCredits,
  estimateGenerationCredits,
} from "@/lib/credit-pricing";
import type {
  GenerationMode,
  VideoDuration,
  VideoQuality,
  VideoResolution,
  VisualReference,
} from "./types";

export const IMAGE_MODEL = "nano-banana-2-lite";
export const VIDEO_MODEL = DEFAULT_VIDEO_MODEL;

export { calculateVideoCredits, estimateGenerationCredits };

/** @deprecated Use estimateGenerationCredits — kept for existing imports. */
export function estimateCredits(
  mode: GenerationMode,
  duration: VideoDuration = 5,
  quality: VideoQuality = "standard",
  options?: { resolution?: VideoResolution; hasAudio?: boolean; model?: string },
): number {
  return estimateGenerationCredits({
    mode,
    model: options?.model ?? VIDEO_MODEL,
    resolution: options?.resolution ?? qualityToResolution(quality),
    hasAudio: options?.hasAudio ?? false,
    durationInSeconds: duration,
  });
}

export function qualityToResolution(quality: VideoQuality): VideoResolution {
  return quality === "pro" ? "1080p" : "720p";
}

export function resolveVideoResolution(input: {
  resolution?: VideoResolution;
  quality?: VideoQuality;
}): VideoResolution {
  if (input.resolution) return input.resolution;
  if (input.quality) return qualityToResolution(input.quality);
  return "720p";
}

export function getModelConfig(mode: GenerationMode): {
  model: string;
  toolMode: string;
  media: "image" | "video";
} {
  switch (mode) {
    case "text-to-image":
      return { model: IMAGE_MODEL, toolMode: "text2image", media: "image" };
    case "text-to-video":
      return { model: VIDEO_MODEL, toolMode: "text2video", media: "video" };
    case "image-to-video":
      return { model: VIDEO_MODEL, toolMode: "image2video", media: "video" };
  }
}

export function buildGenerationParams(input: {
  mode: GenerationMode;
  prompt: string;
  duration: VideoDuration;
  resolution: VideoResolution;
  generateAudio?: boolean;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
}): { model: string; toolMode: string; media: "image" | "video"; params: Record<string, unknown> } {
  const { model, toolMode, media } = getModelConfig(input.mode);
  const generateAudio = Boolean(input.generateAudio);

  if (input.mode === "text-to-image") {
    const params: Record<string, unknown> = {
      prompt: input.prompt,
      imageCount: 1,
      aspectRatio: "1:1",
      autoEnhancePrompt: false,
    };

    if (input.referenceImage) {
      return {
        model,
        toolMode: "image2image",
        media: "image",
        params: {
          ...params,
          visualReferences: [input.referenceImage],
        },
      };
    }

    return { model, toolMode, media, params };
  }

  if (input.mode === "text-to-video") {
    const styleHint = input.referenceImage
      ? ` Match the visual style and subject identity from the reference image (${input.referenceImage.label}).`
      : "";

    const params: Record<string, unknown> = {
      prompt: `${input.prompt}${styleHint}`.trim(),
      videoCount: 1,
      duration: input.duration,
      resolution: input.resolution,
      aspectRatio: "16:9",
      generateAudio,
      autoEnhancePrompt: false,
    };

    return { model, toolMode, media, params };
  }

  if (!input.startFrame) {
    throw new Error("Start frame image is required for Image-to-Video");
  }

  return {
    model,
    toolMode,
    media,
    params: {
      prompt: input.prompt,
      videoCount: 1,
      startFrame: input.startFrame,
      duration: input.duration,
      resolution: input.resolution,
      generateAudio,
    },
  };
}

export function estimateImageCredits(): number {
  return calculateImageCredits();
}
