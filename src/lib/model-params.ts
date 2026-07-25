/**
 * Map Create UI settings → OpenArt MCP param values per model.
 * Keeps quote + generate on the same configuration so ×1.8 pricing stays accurate.
 */

/** Kling video uses std/pro/4k instead of 720p/1080p. */
export function mapResolutionForMcpModel(
  mcpModel: string,
  uiResolution?: string | null,
): string | undefined {
  if (!uiResolution) return undefined;
  const r = uiResolution.trim().toLowerCase();
  if (!r) return undefined;

  if (mcpModel.includes("kling")) {
    if (r.includes("4k") || r === "2160p") return "4k";
    if (r.includes("1080") || r === "1k" || r === "pro") return "pro";
    // 360p / 480p / 720p / std → standard tier
    return "std";
  }

  // PixVerse defaults are often 540p in OpenArt cost tables.
  if (mcpModel.toLowerCase().includes("pixverse")) {
    if (r.includes("1080") || r === "1k") return "1080p";
    if (r.includes("720")) return "720p";
    if (r.includes("480") || r.includes("540") || r.includes("360")) return "540p";
  }

  // Pass through Seedance / Wan / Grok style values (360p…1080p / 1K).
  return uiResolution;
}

export function audioParamForMcpModel(
  mcpModel: string,
  generateAudio?: boolean,
): Record<string, boolean> {
  if (mcpModel.includes("kling")) {
    return { generateSound: Boolean(generateAudio) };
  }
  // Gemini Omni Flash has no audio toggle in default cost form.
  if (mcpModel.includes("gemini-omni")) {
    return {};
  }
  return { generateAudio: Boolean(generateAudio) };
}
