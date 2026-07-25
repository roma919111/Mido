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
  available: boolean;
}

/**
 * Full Veronix model catalog matching the requested OpenArt-style list.
 * Models with mcpId are live via OpenArt MCP; others appear in UI as listed.
 */
export const IMAGE_MODELS: CatalogModel[] = [
  { id: "auto", name: "Auto", kind: "image", mcpId: "nano-banana-2-lite", modes: ["text2image", "image2image"], badge: "Auto", available: true },
  { id: "gpt-image-2", name: "GPT Image 2", kind: "image", mcpId: "gpt-image-2", modes: ["text2image", "image2image"], available: true },
  { id: "nano-banana-2-lite", name: "Nano Banana 2 Lite", kind: "image", mcpId: "nano-banana-2-lite", modes: ["text2image", "image2image"], available: true },
  { id: "nano-banana-2", name: "Nano Banana 2", kind: "image", mcpId: "nano-banana-2", modes: ["text2image", "image2image"], available: true },
  { id: "seedream-5-pro", name: "Seedream 5.0 Pro", kind: "image", available: false },
  { id: "nano-banana-pro", name: "Nano Banana Pro", kind: "image", mcpId: "nano-banana-pro", modes: ["text2image", "image2image"], available: true },
  { id: "recraft-v4", name: "Recraft V4", kind: "image", available: false },
  { id: "recraft", name: "Recraft (image & SVG generation model)", kind: "image", available: false },
  { id: "reve-2-1", name: "Reve 2.1", kind: "image", available: false },
  { id: "wan-2-7-image", name: "Wan 2.7", kind: "image", available: false },
  { id: "grok-imagine-image", name: "Grok Imagine", kind: "image", available: false },
  { id: "seedream-5-lite", name: "Seedream 5.0 Lite", kind: "image", mcpId: "byte-plus-seedream-5-lite", modes: ["text2image", "image2image"], available: true },
  { id: "seedream-4-5", name: "Seedream 4.5", kind: "image", mcpId: "byte-plus-seedream-4-5", modes: ["text2image", "image2image"], available: true },
  { id: "kling-3-omni-image", name: "Kling 3.0 Omni", kind: "image", mcpId: "kling-3-omni", modes: ["text2image", "image2image"], available: true },
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

export const VIDEO_MODELS: CatalogModel[] = [
  { id: "seedance-2", name: "Seedance 2.0", kind: "video", mcpId: "byte-plus-seedance-2", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "seedance-2-fast", name: "Seedance 2.0 Fast", kind: "video", mcpId: "byte-plus-seedance-2-fast", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "seedance-2-mini", name: "Seedance 2.0 Mini", kind: "video", mcpId: "byte-plus-seedance-2-mini", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "gemini-omni-flash", name: "Gemini Omni Flash", kind: "video", mcpId: "gemini-omni-flash", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "kling-3-omni", name: "Kling 3.0 Omni", kind: "video", mcpId: "kling-3-omni", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "pixverse-c1", name: "PixVerse C1", kind: "video", available: false },
  { id: "pixverse-v6", name: "PixVerse V6", kind: "video", mcpId: "pixverseV6", modes: ["text2video", "image2video"], available: true },
  { id: "happyhorse-1-1", name: "HappyHorse 1.1", kind: "video", available: false },
  { id: "happyhorse", name: "HappyHorse", kind: "video", available: false },
  { id: "wan-2-7", name: "Wan 2.7", kind: "video", mcpId: "wan2-7", modes: ["text2video", "image2video", "element2video"], available: true },
  { id: "veo-3-1", name: "Veo 3.1", kind: "video", available: false },
  { id: "kling-3", name: "Kling 3.0", kind: "video", available: false },
  { id: "seedance-1-5-pro", name: "Seedance 1.5 Pro", kind: "video", available: false },
  { id: "grok-imagine", name: "Grok Imagine", kind: "video", mcpId: "grok-imagine-1-5", modes: ["image2video"], available: true },
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

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

export function getCatalogModel(id: string): CatalogModel | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

export function resolveMcpModel(model: CatalogModel): string {
  return model.mcpId || model.id;
}
