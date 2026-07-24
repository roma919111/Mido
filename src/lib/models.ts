import type { GenerationMode, VideoDuration, VideoQuality, VisualReference } from "./types";

export const IMAGE_MODEL = "nano-banana-2-lite";
export const VIDEO_MODEL = "pixverseV6";

export const CREDIT_COSTS = {
  image: 15,
  video: {
    standard: { 5: 70, 10: 140 } as Record<VideoDuration, number>,
    pro: { 5: 150, 10: 300 } as Record<VideoDuration, number>,
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

export function qualityToResolution(quality: VideoQuality): "720p" | "1080p" {
  return quality === "pro" ? "1080p" : "720p";
}

export function getModelConfig(mode: GenerationMode): { model: string; toolMode: string; media: "image" | "video" } {
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
  quality: VideoQuality;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
}): { model: string; toolMode: string; media: "image" | "video"; params: Record<string, unknown> } {
  const { model, toolMode, media } = getModelConfig(input.mode);
  const resolution = qualityToResolution(input.quality);

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
      resolution,
      aspectRatio: "16:9",
      generateAudio: false,
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
      resolution,
      generateAudio: false,
    },
  };
}
