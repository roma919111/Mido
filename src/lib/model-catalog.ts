export type ModelKind = "image" | "video";

export type AudioParamKey = "generateAudio" | "generateSound";

export interface CatalogModel {
  id: string;
  name: string;
  kind: ModelKind;
  /** OpenArt MCP model id when available */
  mcpId?: string;
  /** Modes supported via MCP */
  modes?: string[];
  badge?: string;
  /** Short customer-facing tagline under the name */
  tagline?: string;
  available: boolean;
  /** Synced from openart_model_form_get (video models) */
  durationMin?: number;
  durationMax?: number;
  durationDefault?: number;
  /** OpenArt resolution enum values for this model (empty = no resolution control) */
  resolutions?: string[];
  resolutionDefault?: string;
  /** Whether the model exposes an audio toggle that changes price */
  audioSupported?: boolean;
  audioDefault?: boolean;
  audioParam?: AudioParamKey | null;
}

export type VideoFormFallback = {
  duration: { min: number; max: number; default: number };
  resolutions: string[];
  resolutionDefault: string;
  audioSupported: boolean;
  audioDefault: boolean;
  audioParam: AudioParamKey | null;
};

/** Fallback OpenArt form options when live form sync is unavailable. */
/** Clarity ladder shown in Create — 480p / 720p only (no 1080p / 4K). */
export const VIDEO_CLARITY_LADDER = ["480p", "720p"] as const;

export const VIDEO_FORM_FALLBACKS: Record<string, VideoFormFallback> = {
  "byte-plus-seedance-2-mini": {
    // OpenArt / Seedance window: 4–15s, step 1.
    duration: { min: 4, max: 15, default: 5 },
    resolutions: [...VIDEO_CLARITY_LADDER],
    resolutionDefault: "720p",
    audioSupported: true,
    audioDefault: true,
    audioParam: "generateAudio",
  },
  "byte-plus-seedance-2": {
    duration: { min: 4, max: 15, default: 5 },
    resolutions: [...VIDEO_CLARITY_LADDER],
    resolutionDefault: "720p",
    audioSupported: true,
    audioDefault: true,
    audioParam: "generateAudio",
  },
  "byte-plus-seedance-2-fast": {
    duration: { min: 4, max: 15, default: 5 },
    resolutions: [...VIDEO_CLARITY_LADDER],
    resolutionDefault: "720p",
    audioSupported: true,
    audioDefault: true,
    audioParam: "generateAudio",
  },
  "gemini-omni-flash": {
    duration: { min: 3, max: 10, default: 5 },
    resolutions: [],
    resolutionDefault: "",
    audioSupported: false,
    audioDefault: false,
    audioParam: null,
  },
  "kling-3-omni": {
    duration: { min: 3, max: 15, default: 5 },
    resolutions: ["std", "pro", "4k"],
    resolutionDefault: "std",
    audioSupported: true,
    audioDefault: true,
    audioParam: "generateSound",
  },
  pixverseV6: {
    duration: { min: 1, max: 15, default: 5 },
    resolutions: ["360p", "540p", "720p", "1080p"],
    resolutionDefault: "540p",
    audioSupported: true,
    audioDefault: false,
    audioParam: "generateAudio",
  },
  "wan2-7": {
    duration: { min: 2, max: 15, default: 5 },
    resolutions: ["720p", "1080p"],
    resolutionDefault: "720p",
    audioSupported: false,
    audioDefault: false,
    audioParam: null,
  },
  "grok-imagine-1-5": {
    duration: { min: 1, max: 15, default: 5 },
    resolutions: ["480p", "720p"],
    resolutionDefault: "720p",
    audioSupported: false,
    audioDefault: false,
    audioParam: null,
  },
};

/** @deprecated use VIDEO_FORM_FALLBACKS */
export const VIDEO_DURATION_FALLBACKS: Record<
  string,
  { min: number; max: number; default: number }
> = Object.fromEntries(
  Object.entries(VIDEO_FORM_FALLBACKS).map(([id, f]) => [id, f.duration]),
);

export function formOptionsForModel(model: CatalogModel | null | undefined): {
  duration: { min: number; max: number; default: number };
  resolutions: string[];
  resolutionDefault: string;
  audioSupported: boolean;
  audioDefault: boolean;
  audioParam: AudioParamKey | null;
} {
  const fallback: VideoFormFallback = (model?.mcpId &&
    VIDEO_FORM_FALLBACKS[model.mcpId]) || {
    duration: { min: 4, max: 15, default: 5 },
    resolutions: ["480p", "720p", "1080p"],
    resolutionDefault: "720p",
    audioSupported: true,
    audioDefault: false,
    audioParam: "generateAudio",
  };
  if (!model || model.kind !== "video") {
    return {
      duration: fallback.duration,
      resolutions: fallback.resolutions,
      resolutionDefault: fallback.resolutionDefault,
      audioSupported: false,
      audioDefault: false,
      audioParam: null,
    };
  }
  const resolutions = Array.isArray(model.resolutions)
    ? model.resolutions
    : fallback.resolutions;
  const isVeronix =
    model.id === "seedance-2-mini" ||
    model.mcpId === "byte-plus-seedance-2-mini";
  return {
    duration: isVeronix
      ? {
          min: 4,
          max: 15,
          default: model.durationDefault ?? fallback.duration.default ?? 5,
        }
      : {
          min: model.durationMin ?? fallback.duration.min,
          max: model.durationMax ?? fallback.duration.max,
          default: model.durationDefault ?? fallback.duration.default,
        },
    resolutions: isVeronix ? [...VIDEO_CLARITY_LADDER] : resolutions,
    resolutionDefault:
      model.resolutionDefault ||
      fallback.resolutionDefault ||
      (isVeronix ? "720p" : resolutions[0] || ""),
    audioSupported: model.audioSupported ?? fallback.audioSupported,
    audioDefault: model.audioDefault ?? fallback.audioDefault,
    audioParam:
      model.audioParam !== undefined ? model.audioParam : fallback.audioParam,
  };
}

export function durationBoundsForModel(model: CatalogModel | null | undefined): {
  min: number;
  max: number;
  default: number;
} {
  return formOptionsForModel(model).duration;
}

/** Friendly labels for synced OpenArt resolution enums. */
export function resolutionLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "std") return "قياسي";
  if (v === "pro") return "Pro";
  if (v === "4k") return "4K";
  return value;
}

/**
 * Full Veronix catalog (live OpenArt + coming-soon).
 * Live sync overlays form/pricing fields onto matching ids.
 */
export const IMAGE_MODELS: CatalogModel[] = [
  {
    id: "vyronix-image",
    name: "VYRONIX",
    kind: "image",
    mcpId: "byte-plus-seedream-4-5",
    modes: ["text2image", "image2image"],
    badge: "حصري",
    tagline: "تم إنشاؤه بواسطة VYRONIX",
    available: true,
  },
  { id: "auto", name: "Auto", kind: "image", mcpId: "nano-banana-2-lite", modes: ["text2image", "image2image"], badge: "Auto", available: false },
  { id: "gpt-image-2", name: "GPT Image 2", kind: "image", mcpId: "gpt-image-2", modes: ["text2image", "image2image"], available: false },
  { id: "nano-banana-2-lite", name: "Nano Banana 2 Lite", kind: "image", mcpId: "nano-banana-2-lite", modes: ["text2image", "image2image"], available: false },
  { id: "nano-banana-2", name: "Nano Banana 2", kind: "image", mcpId: "nano-banana-2", modes: ["text2image", "image2image"], available: false },
  { id: "seedream-5-pro", name: "Seedream 5.0 Pro", kind: "image", available: false },
  { id: "nano-banana-pro", name: "Nano Banana Pro", kind: "image", mcpId: "nano-banana-pro", modes: ["text2image", "image2image"], available: false },
  { id: "recraft-v4", name: "Recraft V4", kind: "image", available: false },
  { id: "recraft", name: "Recraft (image & SVG generation model)", kind: "image", available: false },
  { id: "reve-2-1", name: "Reve 2.1", kind: "image", available: false },
  { id: "wan-2-7-image", name: "Wan 2.7", kind: "image", available: false },
  { id: "grok-imagine-image", name: "Grok Imagine", kind: "image", available: false },
  { id: "seedream-5-lite", name: "Seedream 5.0 Lite", kind: "image", mcpId: "byte-plus-seedream-5-lite", modes: ["text2image", "image2image"], available: false },
  { id: "seedream-4-5", name: "Seedream 4.5", kind: "image", mcpId: "byte-plus-seedream-4-5", modes: ["text2image", "image2image"], available: false },
  { id: "kling-3-omni-image", name: "Kling 3.0 Omni", kind: "image", mcpId: "kling-3-omni", modes: ["text2image", "image2image"], available: false },
  { id: "nano-banana", name: "Nano Banana", kind: "image", available: false },
  { id: "seedream-4", name: "Seedream 4.0", kind: "image", available: false },
  { id: "qwen-image-2", name: "Qwen Image 2", kind: "image", available: false },
  { id: "kling-01-image", name: "Kling 01", kind: "image", available: false },
  { id: "flux-kontext-pro", name: "Flux Kontext Pro", kind: "image", available: false },
  { id: "gpt-image-1-5", name: "GPT Image 1.5", kind: "image", available: false },
  { id: "flux-2-pro", name: "Flux 2 Pro", kind: "image", available: false },
  { id: "veronix-photorealistic", name: "Veronix Photorealistic", kind: "image", available: false, badge: "Veronix" },
  { id: "z-image", name: "Z-Image", kind: "image", available: false },
  { id: "qwen-image-max", name: "qwen-image-max", kind: "image", available: false },
  { id: "qwen-image-plus", name: "qwen-image-plus", kind: "image", available: false },
  { id: "flux-2-klein-9b", name: "Flux 2 Klein 9B", kind: "image", available: false },
  { id: "flux-2-max", name: "Flux 2 Max", kind: "image", available: false },
  { id: "flux-2-flex", name: "Flux 2 Flex", kind: "image", available: false },
  { id: "flux-1-dev", name: "Flux 1 Dev", kind: "image", available: false },
  { id: "flux-1-1-pro", name: "Flux 1.1 Pro", kind: "image", available: false },
  { id: "flux-kontext-max", name: "Flux Kontext Max", kind: "image", available: false },
  { id: "juggernaut-flux-pro", name: "Juggernaut Flux Pro", kind: "image", available: false },
  { id: "veronix-sdxl", name: "Veronix SDXL", kind: "image", available: false, badge: "Veronix" },
  { id: "juggernaut-xl", name: "Juggernaut XL", kind: "image", available: false },
  { id: "dynavision-xl", name: "DynaVision XL", kind: "image", available: false },
  { id: "flux-2-lora-gallery", name: "Flux 2 LoRA Gallery Realism", kind: "image", available: false },
  { id: "wai-ani-ponyxl", name: "WAI-ANI PonyXL", kind: "image", available: false },
];

function withFormFallback(model: CatalogModel): CatalogModel {
  const fallback = model.mcpId ? VIDEO_FORM_FALLBACKS[model.mcpId] : undefined;
  if (!fallback) return model;
  return {
    ...model,
    durationMin: model.durationMin ?? fallback.duration.min,
    durationMax: model.durationMax ?? fallback.duration.max,
    durationDefault: model.durationDefault ?? fallback.duration.default,
    resolutions: Array.isArray(model.resolutions)
      ? model.resolutions
      : fallback.resolutions,
    resolutionDefault: model.resolutionDefault || fallback.resolutionDefault,
    audioSupported: model.audioSupported ?? fallback.audioSupported,
    audioDefault: model.audioDefault ?? fallback.audioDefault,
    audioParam:
      model.audioParam !== undefined ? model.audioParam : fallback.audioParam,
  };
}

const VIDEO_MODELS_BASE: CatalogModel[] = [
  {
    id: "seedance-2-mini",
    name: "VYRONIX",
    kind: "video",
    mcpId: "byte-plus-seedance-2-mini",
    modes: ["text2video", "image2video", "element2video"],
    badge: "حصري",
    tagline: "تم إنشاؤه بواسطة VYRONIX — أول فيديو مجاني (مقدمة + 4 ثوانٍ · 480p)",
    available: true,
  },
  { id: "seedance-2", name: "Seedance 2.0", kind: "video", mcpId: "byte-plus-seedance-2", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "seedance-2-fast", name: "Seedance 2.0 Fast", kind: "video", mcpId: "byte-plus-seedance-2-fast", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "gemini-omni-flash", name: "Gemini Omni Flash", kind: "video", mcpId: "gemini-omni-flash", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "kling-3-omni", name: "Kling 3.0 Omni", kind: "video", mcpId: "kling-3-omni", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "pixverse-v6", name: "PixVerse V6", kind: "video", mcpId: "pixverseV6", modes: ["text2video", "image2video", "fusion"], available: true },
  { id: "wan-2-7", name: "Wan 2.7", kind: "video", mcpId: "wan2-7", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "grok-imagine", name: "Grok Imagine", kind: "video", mcpId: "grok-imagine-1-5", modes: ["image2video"], available: true },
  { id: "pixverse-c1", name: "PixVerse C1", kind: "video", available: false },
  { id: "happyhorse-1-1", name: "HappyHorse 1.1", kind: "video", available: false },
  { id: "happyhorse", name: "HappyHorse", kind: "video", available: false },
  { id: "veo-3-1", name: "Veo 3.1", kind: "video", available: false },
  { id: "kling-3", name: "Kling 3.0", kind: "video", available: false },
  { id: "seedance-1-5-pro", name: "Seedance 1.5 Pro", kind: "video", available: false },
  { id: "kling-2-6", name: "Kling 2.6", kind: "video", available: false },
  { id: "wan-2-6", name: "Wan 2.6", kind: "video", available: false },
  { id: "sora-2", name: "Sora 2", kind: "video", available: false },
  { id: "ltx-2-3", name: "LTX 2.3", kind: "video", available: false },
  { id: "ltx-2-3-a2v", name: "LTX 2.3 Audio-to-Video", kind: "video", available: false },
  { id: "kling-2-5", name: "Kling 2.5", kind: "video", available: false },
  { id: "kling-01", name: "Kling 01", kind: "video", available: false },
  { id: "veo-3", name: "Veo 3", kind: "video", available: false },
  { id: "wan-2-5", name: "Wan 2.5", kind: "video", available: false },
  { id: "hailuo-02", name: "Hailuo 02", kind: "video", available: false },
  { id: "hailuo-2-3", name: "Hailuo 2.3", kind: "video", available: false },
  { id: "kling-2-1", name: "Kling 2.1", kind: "video", available: false },
  { id: "seedance-1", name: "Seedance 1", kind: "video", available: false },
  { id: "vidu-q3", name: "Vidu Q3", kind: "video", available: false },
  { id: "pixverse-5", name: "PixVerse 5", kind: "video", available: false },
  { id: "wan-2-2", name: "Wan 2.2", kind: "video", available: false },
  { id: "vidu-q2", name: "Vidu Q2", kind: "video", available: false },
];

export const VIDEO_MODELS: CatalogModel[] =
  VIDEO_MODELS_BASE.map(withFormFallback);

/** Merge live OpenArt rows onto the full static catalog (keeps coming-soon models). */
export function mergeLiveIntoFullCatalog(live: {
  image: CatalogModel[];
  video: CatalogModel[];
}): { image: CatalogModel[]; video: CatalogModel[] } {
  const mergeSide = (
    staticList: CatalogModel[],
    liveList: CatalogModel[],
  ): CatalogModel[] => {
    const liveById = new Map(liveList.map((m) => [m.id, m]));
    const used = new Set<string>();
    const merged = staticList.map((staticModel) => {
      const liveModel = liveById.get(staticModel.id);
      if (!liveModel) return staticModel;
      used.add(staticModel.id);
      return withFormFallback({
        ...staticModel,
        ...liveModel,
        // Keep branded name/badge/tagline from static when present.
        name: staticModel.name || liveModel.name,
        badge: staticModel.badge ?? liveModel.badge,
        tagline: staticModel.tagline ?? liveModel.tagline,
        available: true,
      });
    });
    for (const liveModel of liveList) {
      if (used.has(liveModel.id)) continue;
      merged.push(withFormFallback(liveModel));
    }
    return merged;
  };

  return {
    image: mergeSide(IMAGE_MODELS, live.image),
    video: mergeSide(VIDEO_MODELS, live.video),
  };
}

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

let liveCatalogCache: { image: CatalogModel[]; video: CatalogModel[] } | null =
  null;

export function setLiveCatalogCache(input: {
  image: CatalogModel[];
  video: CatalogModel[];
}) {
  liveCatalogCache = {
    image: input.image,
    video: input.video,
  };
}

export function getActiveCatalog(): {
  image: CatalogModel[];
  video: CatalogModel[];
  all: CatalogModel[];
} {
  const image = liveCatalogCache?.image?.length
    ? liveCatalogCache.image
    : IMAGE_MODELS;
  const video = liveCatalogCache?.video?.length
    ? liveCatalogCache.video
    : VIDEO_MODELS;
  return { image, video, all: [...image, ...video] };
}

export function getCatalogModel(id: string): CatalogModel | undefined {
  return (
    getActiveCatalog().all.find((m) => m.id === id) ||
    ALL_MODELS.find((m) => m.id === id)
  );
}

export function resolveMcpModel(model: CatalogModel): string {
  return model.mcpId || model.id;
}
