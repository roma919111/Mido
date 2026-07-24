import type {
  AspectRatio,
  GenerationMode,
  StylePreset,
  VideoDuration,
  VideoQuality,
  VisualReference,
} from "./types";

export const IMAGE_MODEL = "nano-banana-2-lite";
export const VIDEO_MODEL = "pixverseV6";

/** App-facing credit costs (Studio AI wallet). */
export const APP_CREDIT_COSTS = {
  image: 2,
  video: 10,
  inpaint: 2,
} as const;

export const STYLE_PRESET_PROMPTS: Record<Exclude<StylePreset, "none">, string> = {
  cinematic:
    "cinematic lighting, anamorphic lens feel, film color grade, dramatic atmosphere",
  anime: "anime illustration style, clean linework, vibrant cel shading, expressive eyes",
  photorealistic:
    "photorealistic photography, natural skin texture, accurate lighting, 85mm lens",
  cyberpunk:
    "cyberpunk neon nightlife, holographic accents, rainy reflective streets, futuristic city",
  "3d-render":
    "octane 3d render, subsurface scattering, crisp materials, studio product lighting",
};

export function estimateAppCredits(mode: GenerationMode): number {
  if (mode === "text-to-image" || mode === "inpaint") return APP_CREDIT_COSTS.image;
  return APP_CREDIT_COSTS.video;
}

export function qualityToResolution(quality: VideoQuality): "720p" | "1080p" {
  return quality === "pro" ? "1080p" : "720p";
}

export function applyStyleToPrompt(prompt: string, style: StylePreset = "none"): string {
  if (!style || style === "none") return prompt.trim();
  const suffix = STYLE_PRESET_PROMPTS[style];
  if (!suffix) return prompt.trim();
  if (prompt.toLowerCase().includes(suffix.slice(0, 18).toLowerCase())) return prompt.trim();
  return `${prompt.trim()}. ${suffix}`;
}

export function buildGenerationParams(input: {
  mode: GenerationMode;
  prompt: string;
  negativePrompt?: string;
  stylePreset?: StylePreset;
  aspectRatio?: AspectRatio;
  duration?: VideoDuration;
  quality?: VideoQuality;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
}): { model: string; toolMode: string; media: "image" | "video"; params: Record<string, unknown> } {
  const prompt = applyStyleToPrompt(input.prompt, input.stylePreset ?? "none");
  const aspectRatio = input.aspectRatio ?? "1:1";
  const duration = input.duration ?? 5;
  const resolution = qualityToResolution(input.quality ?? "standard");

  if (input.mode === "text-to-image" || input.mode === "inpaint") {
    const params: Record<string, unknown> = {
      prompt:
        input.mode === "inpaint"
          ? `${prompt}. Carefully edit the provided reference while preserving composition.`
          : prompt,
      imageCount: 1,
      aspectRatio,
      autoEnhancePrompt: false,
    };

    if (input.negativePrompt?.trim()) {
      params.negativePrompt = input.negativePrompt.trim();
    }

    if (input.referenceImage || input.startFrame) {
      const ref = input.referenceImage ?? input.startFrame;
      return {
        model: IMAGE_MODEL,
        toolMode: "image2image",
        media: "image",
        params: {
          ...params,
          visualReferences: [ref],
        },
      };
    }

    return {
      model: IMAGE_MODEL,
      toolMode: "text2image",
      media: "image",
      params,
    };
  }

  if (input.mode === "text-to-video") {
    const styleHint = input.referenceImage
      ? ` Match the visual style from reference (${input.referenceImage.label}).`
      : "";

    return {
      model: VIDEO_MODEL,
      toolMode: "text2video",
      media: "video",
      params: {
        prompt: `${prompt}${styleHint}`.trim(),
        videoCount: 1,
        duration,
        resolution,
        aspectRatio: aspectRatio === "1:1" || aspectRatio === "4:3" ? "16:9" : aspectRatio,
        generateAudio: false,
        autoEnhancePrompt: false,
      },
    };
  }

  if (!input.startFrame) {
    throw new Error("Start frame image is required for Image-to-Video");
  }

  return {
    model: VIDEO_MODEL,
    toolMode: "image2video",
    media: "video",
    params: {
      prompt,
      videoCount: 1,
      startFrame: input.startFrame,
      duration,
      resolution,
      generateAudio: false,
    },
  };
}
