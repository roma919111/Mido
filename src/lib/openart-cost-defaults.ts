/**
 * Seeded OpenArt model costs (from openart_model_cost).
 * Used when the platform owner MCP session is offline so Create can still
 * show live-synced prices. Generation still requires a connected owner account.
 */

export interface CostCacheItem {
  model: string;
  mode: string;
  totalCredits: number;
  unitCredits: number;
  config: Record<string, unknown>;
  mediaType?: string;
}

/** Defaults + common Create UI configurations captured from OpenArt. */
export const OPENART_COST_DEFAULTS: CostCacheItem[] = [
  // Images
  { model: "kling-3-omni", mode: "text2image", totalCredits: 10, unitCredits: 10, config: { imageCount: 1, resolution: "1k", aspectRatio: "4:3" }, mediaType: "image" },
  { model: "kling-3-omni", mode: "image2image", totalCredits: 10, unitCredits: 10, config: { imageCount: 1, resolution: "1k", aspectRatio: "4:3" }, mediaType: "image" },
  { model: "nano-banana-2-lite", mode: "text2image", totalCredits: 15, unitCredits: 15, config: { imageCount: 1, aspectRatio: "1:1" }, mediaType: "image" },
  { model: "nano-banana-2-lite", mode: "image2image", totalCredits: 15, unitCredits: 15, config: { imageCount: 1, aspectRatio: "1:1" }, mediaType: "image" },
  { model: "byte-plus-seedream-4-5", mode: "text2image", totalCredits: 15, unitCredits: 15, config: { imageCount: 1, resolution: "2K", aspectRatio: "4:3" }, mediaType: "image" },
  { model: "byte-plus-seedream-4-5", mode: "image2image", totalCredits: 15, unitCredits: 15, config: { imageCount: 1, resolution: "2K", aspectRatio: "4:3" }, mediaType: "image" },
  { model: "byte-plus-seedream-5-lite", mode: "text2image", totalCredits: 15, unitCredits: 15, config: { imageCount: 1, resolution: "2K", aspectRatio: "4:3" }, mediaType: "image" },
  { model: "byte-plus-seedream-5-lite", mode: "image2image", totalCredits: 15, unitCredits: 15, config: { imageCount: 1, resolution: "2K", aspectRatio: "4:3" }, mediaType: "image" },
  { model: "nano-banana-2", mode: "text2image", totalCredits: 20, unitCredits: 20, config: { imageCount: 1, resolution: "1K", aspectRatio: "1:1" }, mediaType: "image" },
  { model: "nano-banana-2", mode: "image2image", totalCredits: 20, unitCredits: 20, config: { imageCount: 1, resolution: "1K", aspectRatio: "1:1" }, mediaType: "image" },
  { model: "nano-banana-pro", mode: "text2image", totalCredits: 40, unitCredits: 40, config: { imageCount: 1, resolution: "1K", aspectRatio: "1:1" }, mediaType: "image" },
  { model: "nano-banana-pro", mode: "image2image", totalCredits: 40, unitCredits: 40, config: { imageCount: 1, resolution: "1K", aspectRatio: "1:1" }, mediaType: "image" },
  { model: "gpt-image-2", mode: "text2image", totalCredits: 40, unitCredits: 40, config: { imageCount: 1, resolutionTier: "2k", aspectRatio: "4:3", quality: "medium" }, mediaType: "image" },
  { model: "gpt-image-2", mode: "image2image", totalCredits: 42, unitCredits: 42, config: { imageCount: 1, resolutionTier: "2k", aspectRatio: "4:3", quality: "medium" }, mediaType: "image" },

  // Video — PixVerse (audio changes price; duration scales linearly)
  { model: "pixverseV6", mode: "text2video", totalCredits: 50, unitCredits: 50, config: { videoCount: 1, resolution: "540p", duration: 5, aspectRatio: "16:9", generateAudio: false }, mediaType: "video" },
  { model: "pixverseV6", mode: "text2video", totalCredits: 70, unitCredits: 70, config: { videoCount: 1, resolution: "540p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "pixverseV6", mode: "image2video", totalCredits: 50, unitCredits: 50, config: { videoCount: 1, resolution: "540p", duration: 5, generateAudio: false }, mediaType: "video" },
  { model: "pixverseV6", mode: "image2video", totalCredits: 70, unitCredits: 70, config: { videoCount: 1, resolution: "540p", duration: 5, generateAudio: true }, mediaType: "video" },
  { model: "pixverseV6", mode: "text2video", totalCredits: 70, unitCredits: 70, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: false }, mediaType: "video" },
  { model: "pixverseV6", mode: "text2video", totalCredits: 90, unitCredits: 90, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "pixverseV6", mode: "image2video", totalCredits: 70, unitCredits: 70, config: { videoCount: 1, resolution: "720p", duration: 5, generateAudio: false }, mediaType: "video" },
  { model: "pixverseV6", mode: "image2video", totalCredits: 90, unitCredits: 90, config: { videoCount: 1, resolution: "720p", duration: 5, generateAudio: true }, mediaType: "video" },
  { model: "pixverseV6", mode: "text2video", totalCredits: 140, unitCredits: 140, config: { videoCount: 1, resolution: "720p", duration: 10, aspectRatio: "16:9", generateAudio: false }, mediaType: "video" },
  { model: "pixverseV6", mode: "text2video", totalCredits: 180, unitCredits: 180, config: { videoCount: 1, resolution: "720p", duration: 10, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },

  // Wan
  { model: "wan2-7", mode: "text2video", totalCredits: 125, unitCredits: 125, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9" }, mediaType: "video" },
  { model: "wan2-7", mode: "image2video", totalCredits: 125, unitCredits: 125, config: { videoCount: 1, resolution: "720p", duration: 5 }, mediaType: "video" },
  { model: "wan2-7", mode: "element2video", totalCredits: 125, unitCredits: 125, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9" }, mediaType: "video" },

  // Kling video (generateSound changes price)
  { model: "kling-3-omni", mode: "text2video", totalCredits: 125, unitCredits: 125, config: { videoCount: 1, resolution: "std", duration: 5, aspectRatio: "16:9", generateSound: false }, mediaType: "video" },
  { model: "kling-3-omni", mode: "text2video", totalCredits: 175, unitCredits: 175, config: { videoCount: 1, resolution: "std", duration: 5, aspectRatio: "16:9", generateSound: true }, mediaType: "video" },
  { model: "kling-3-omni", mode: "image2video", totalCredits: 125, unitCredits: 125, config: { videoCount: 1, resolution: "std", duration: 5, generateSound: false }, mediaType: "video" },
  { model: "kling-3-omni", mode: "image2video", totalCredits: 175, unitCredits: 175, config: { videoCount: 1, resolution: "std", duration: 5, generateSound: true }, mediaType: "video" },
  { model: "kling-3-omni", mode: "element2video", totalCredits: 125, unitCredits: 125, config: { videoCount: 1, resolution: "std", duration: 5, aspectRatio: "16:9", generateSound: false }, mediaType: "video" },
  { model: "kling-3-omni", mode: "element2video", totalCredits: 175, unitCredits: 175, config: { videoCount: 1, resolution: "std", duration: 5, aspectRatio: "16:9", generateSound: true }, mediaType: "video" },

  // Seedance family
  { model: "byte-plus-seedance-2-mini", mode: "text2video", totalCredits: 200, unitCredits: 200, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: false }, mediaType: "video" },
  { model: "byte-plus-seedance-2-mini", mode: "text2video", totalCredits: 200, unitCredits: 200, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2-mini", mode: "image2video", totalCredits: 200, unitCredits: 200, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2-mini", mode: "element2video", totalCredits: 200, unitCredits: 200, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2-fast", mode: "text2video", totalCredits: 350, unitCredits: 350, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2-fast", mode: "image2video", totalCredits: 350, unitCredits: 350, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2-fast", mode: "element2video", totalCredits: 350, unitCredits: 350, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2", mode: "text2video", totalCredits: 400, unitCredits: 400, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: false }, mediaType: "video" },
  { model: "byte-plus-seedance-2", mode: "text2video", totalCredits: 400, unitCredits: 400, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2", mode: "image2video", totalCredits: 400, unitCredits: 400, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },
  { model: "byte-plus-seedance-2", mode: "element2video", totalCredits: 400, unitCredits: 400, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "16:9", generateAudio: true }, mediaType: "video" },

  // Gemini / Grok
  { model: "gemini-omni-flash", mode: "text2video", totalCredits: 250, unitCredits: 250, config: { videoCount: 1, duration: 5, aspectRatio: "16:9" }, mediaType: "video" },
  { model: "gemini-omni-flash", mode: "image2video", totalCredits: 250, unitCredits: 250, config: { videoCount: 1, duration: 5, aspectRatio: "16:9" }, mediaType: "video" },
  { model: "gemini-omni-flash", mode: "element2video", totalCredits: 250, unitCredits: 250, config: { videoCount: 1, duration: 5, aspectRatio: "16:9" }, mediaType: "video" },
  { model: "grok-imagine-1-5", mode: "image2video", totalCredits: 405, unitCredits: 405, config: { videoCount: 1, resolution: "720p", duration: 5, aspectRatio: "auto" }, mediaType: "video" },
];
