import type {
  GenerationMode,
  VideoDuration,
  VideoModel,
  VideoQuality,
  VisualReference,
} from "./types";

export const IMAGE_MODEL = "nano-banana-2-lite";
export const VIDEO_MODEL = "pixverseV6";
export const GEMINI_VIDEO_MODEL_ID = "gemini-omni-flash-preview";

export const VIDEO_MODEL_OPTIONS: Record<
  VideoModel,
  { label: string; description: string; provider: "openart" | "gemini" }
> = {
  pixverse: {
    label: "Pixverse V6",
    description: "OpenArt · 720p / 1080p",
    provider: "openart",
  },
  "gemini-omni": {
    label: "Gemini Omni Flash",
    description: "Google · 720p · up to 10s",
    provider: "gemini",
  },
};

export const CREDIT_COSTS = {
  image: 15,
  video: {
    pixverse: {
      standard: { 5: 70, 10: 140 } as Record<VideoDuration, number>,
      pro: { 5: 150, 10: 300 } as Record<VideoDuration, number>,
    },
    "gemini-omni": {
      standard: { 5: 80, 10: 160 } as Record<VideoDuration, number>,
      pro: { 5: 80, 10: 160 } as Record<VideoDuration, number>,
    },
  },
} as const;

export function estimateCredits(
  mode: GenerationMode,
  duration: VideoDuration = 5,
  quality: VideoQuality = "standard",
  videoModel: VideoModel = "pixverse",
): number {
  if (mode === "text-to-image") return CREDIT_COSTS.image;
  return CREDIT_COSTS.video[videoModel][quality][duration];
}

export function qualityToResolution(quality: VideoQuality): "720p" | "1080p" {
  return quality === "pro" ? "1080p" : "720p";
}

export function getVideoProvider(videoModel: VideoModel): "openart" | "gemini" {
  return VIDEO_MODEL_OPTIONS[videoModel].provider;
}

export function getModelConfig(
  mode: GenerationMode,
  videoModel: VideoModel = "pixverse",
): { model: string; toolMode: string; media: "image" | "video"; provider: "openart" | "gemini" } {
  switch (mode) {
    case "text-to-image":
      return { model: IMAGE_MODEL, toolMode: "text2image", media: "image", provider: "openart" };
    case "text-to-video":
      return videoModel === "gemini-omni"
        ? {
            model: GEMINI_VIDEO_MODEL_ID,
            toolMode: "text2video",
            media: "video",
            provider: "gemini",
          }
        : { model: VIDEO_MODEL, toolMode: "text2video", media: "video", provider: "openart" };
    case "image-to-video":
      return videoModel === "gemini-omni"
        ? {
            model: GEMINI_VIDEO_MODEL_ID,
            toolMode: "image2video",
            media: "video",
            provider: "gemini",
          }
        : { model: VIDEO_MODEL, toolMode: "image2video", media: "video", provider: "openart" };
  }
}

export function buildGenerationParams(input: {
  mode: GenerationMode;
  prompt: string;
  duration: VideoDuration;
  quality: VideoQuality;
  videoModel?: VideoModel;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
}): {
  model: string;
  toolMode: string;
  media: "image" | "video";
  provider: "openart" | "gemini";
  params: Record<string, unknown>;
} {
  const videoModel = input.videoModel ?? "pixverse";
  const { model, toolMode, media, provider } = getModelConfig(input.mode, videoModel);
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
        provider,
        params: {
          ...params,
          visualReferences: [input.referenceImage],
        },
      };
    }

    return { model, toolMode, media, provider, params };
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

    return { model, toolMode, media, provider, params };
  }

  if (!input.startFrame) {
    throw new Error("Start frame image is required for Image-to-Video");
  }

  return {
    model,
    toolMode,
    media,
    provider,
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
