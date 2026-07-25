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
export const VIDEO_FORM_FALLBACKS: Record<string, VideoFormFallback> = {
  "byte-plus-seedance-2-mini": {
    duration: { min: 4, max: 15, default: 5 },
    resolutions: ["480p", "720p"],
    resolutionDefault: "720p",
    audioSupported: true,
    audioDefault: true,
    audioParam: "generateAudio",
  },
  "byte-plus-seedance-2": {
    duration: { min: 4, max: 15, default: 5 },
    resolutions: ["480p", "720p", "1080p", "4k"],
    resolutionDefault: "720p",
    audioSupported: true,
    audioDefault: true,
    audioParam: "generateAudio",
  },
  "byte-plus-seedance-2-fast": {
    duration: { min: 4, max: 15, default: 5 },
    resolutions: ["480p", "720p", "1080p", "4k"],
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
  return {
    duration: {
      min: model.durationMin ?? fallback.duration.min,
      max: model.durationMax ?? fallback.duration.max,
      default: model.durationDefault ?? fallback.duration.default,
    },
    resolutions,
    resolutionDefault:
      model.resolutionDefault ||
      fallback.resolutionDefault ||
      resolutions[0] ||
      "",
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
 * Fallback catalog = every model currently exposed by OpenArt MCP.
 * Live sync via /api/models refreshes this from openart_model_list.
 */
export const IMAGE_MODELS: CatalogModel[] = [
  {
    id: "auto",
    name: "Auto",
    kind: "image",
    mcpId: "nano-banana-2-lite",
    modes: ["text2image", "image2image"],
    badge: "Auto",
    available: true,
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    kind: "image",
    mcpId: "gpt-image-2",
    modes: ["text2image", "image2image"],
    available: true,
  },
  {
    id: "nano-banana-2-lite",
    name: "Nano Banana 2 Lite",
    kind: "image",
    mcpId: "nano-banana-2-lite",
    modes: ["text2image", "image2image"],
    available: true,
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    kind: "image",
    mcpId: "nano-banana-2",
    modes: ["text2image", "image2image"],
    available: true,
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    kind: "image",
    mcpId: "nano-banana-pro",
    modes: ["text2image", "image2image"],
    available: true,
  },
  {
    id: "seedream-5-lite",
    name: "Seedream 5 Lite",
    kind: "image",
    mcpId: "byte-plus-seedream-5-lite",
    modes: ["text2image", "image2image"],
    available: true,
  },
  {
    id: "seedream-4-5",
    name: "Seedream 4.5",
    kind: "image",
    mcpId: "byte-plus-seedream-4-5",
    modes: ["text2image", "image2image"],
    available: true,
  },
  {
    id: "kling-3-omni-image",
    name: "Kling 3.0 Omni",
    kind: "image",
    mcpId: "kling-3-omni",
    modes: ["text2image", "image2image"],
    available: true,
  },
];

function withFormFallback(model: CatalogModel): CatalogModel {
  const fallback = model.mcpId ? VIDEO_FORM_FALLBACKS[model.mcpId] : undefined;
  if (!fallback) return model;
  return {
    ...model,
    durationMin: model.durationMin ?? fallback.duration.min,
    durationMax: model.durationMax ?? fallback.duration.max,
    durationDefault: model.durationDefault ?? fallback.duration.default,
    resolutions: model.resolutions?.length
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
    name: "Veronix",
    kind: "video",
    mcpId: "byte-plus-seedance-2-mini",
    modes: ["text2video", "image2video", "element2video"],
    badge: "حصري",
    tagline: "موديل فيديو حصري — أول فيديو 6 ثوانٍ مجاني (480p)",
    available: true,
  },
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    kind: "video",
    mcpId: "byte-plus-seedance-2",
    modes: ["text2video", "image2video", "element2video"],
    available: true,
  },
  {
    id: "seedance-2-fast",
    name: "Seedance 2.0 Fast",
    kind: "video",
    mcpId: "byte-plus-seedance-2-fast",
    modes: ["text2video", "image2video", "element2video"],
    available: true,
  },
  {
    id: "gemini-omni-flash",
    name: "Gemini Omni Flash",
    kind: "video",
    mcpId: "gemini-omni-flash",
    modes: ["text2video", "image2video", "element2video"],
    available: true,
  },
  {
    id: "kling-3-omni",
    name: "Kling 3.0 Omni",
    kind: "video",
    mcpId: "kling-3-omni",
    modes: ["text2video", "image2video", "element2video"],
    available: true,
  },
  {
    id: "pixverse-v6",
    name: "PixVerse V6",
    kind: "video",
    mcpId: "pixverseV6",
    modes: ["text2video", "image2video"],
    available: true,
  },
  {
    id: "wan-2-7",
    name: "Wan 2.7",
    kind: "video",
    mcpId: "wan2-7",
    modes: ["text2video", "image2video", "element2video"],
    available: true,
  },
  {
    id: "grok-imagine",
    name: "Grok Imagine 1.5",
    kind: "video",
    mcpId: "grok-imagine-1-5",
    modes: ["image2video"],
    available: true,
  },
];

export const VIDEO_MODELS: CatalogModel[] =
  VIDEO_MODELS_BASE.map(withFormFallback);

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
  return getActiveCatalog().all.find((m) => m.id === id);
}

export function resolveMcpModel(model: CatalogModel): string {
  return model.mcpId || model.id;
}
