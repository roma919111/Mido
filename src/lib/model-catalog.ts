export type ModelKind = "image" | "video";

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
}

/** Fallback OpenArt duration bounds when live form sync is unavailable. */
export const VIDEO_DURATION_FALLBACKS: Record<
  string,
  { min: number; max: number; default: number }
> = {
  "byte-plus-seedance-2-mini": { min: 4, max: 15, default: 5 },
  "byte-plus-seedance-2": { min: 4, max: 15, default: 5 },
  "byte-plus-seedance-2-fast": { min: 4, max: 15, default: 5 },
  "gemini-omni-flash": { min: 3, max: 10, default: 5 },
  "kling-3-omni": { min: 3, max: 15, default: 5 },
  pixverseV6: { min: 1, max: 15, default: 5 },
  "wan2-7": { min: 2, max: 15, default: 5 },
  "grok-imagine-1-5": { min: 1, max: 15, default: 5 },
};

export function durationBoundsForModel(model: CatalogModel | null | undefined): {
  min: number;
  max: number;
  default: number;
} {
  if (!model || model.kind !== "video") {
    return { min: 4, max: 15, default: 5 };
  }
  const fallback =
    (model.mcpId && VIDEO_DURATION_FALLBACKS[model.mcpId]) || {
      min: 4,
      max: 15,
      default: 5,
    };
  return {
    min: model.durationMin ?? fallback.min,
    max: model.durationMax ?? fallback.max,
    default: model.durationDefault ?? fallback.default,
  };
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

function withDurationFallback(model: CatalogModel): CatalogModel {
  const bounds = model.mcpId ? VIDEO_DURATION_FALLBACKS[model.mcpId] : undefined;
  if (!bounds) return model;
  return {
    ...model,
    durationMin: model.durationMin ?? bounds.min,
    durationMax: model.durationMax ?? bounds.max,
    durationDefault: model.durationDefault ?? bounds.default,
  };
}

export const VIDEO_MODELS: CatalogModel[] = [
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
].map(withDurationFallback);

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
