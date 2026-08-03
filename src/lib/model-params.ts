/**
 * Map Create UI settings → OpenArt MCP param values per model.
 * Keeps quote + generate on the same configuration so ×1.8 pricing stays accurate.
 */

import type { AudioParamKey } from "@/lib/model-catalog";

/** Prefer synced OpenArt enum values; fall back to legacy UI→MCP mapping. */
export function mapResolutionForMcpModel(
  mcpModel: string,
  uiResolution?: string | null,
): string | undefined {
  if (!uiResolution) return undefined;
  const raw = uiResolution.trim();
  if (!raw) return undefined;
  const r = raw.toLowerCase();

  // Already an OpenArt enum value (synced into Create UI) — pass through.
  if (
    ["std", "pro", "4k", "360p", "480p", "540p", "720p", "1080p", "1k", "2k"].includes(
      r,
    )
  ) {
    if (r === "4k") return "4k";
    return raw;
  }

  if (mcpModel.includes("kling")) {
    if (r.includes("4k") || r === "2160p") return "4k";
    if (r.includes("1080") || r === "1k" || r === "pro") return "pro";
    return "std";
  }

  if (mcpModel.toLowerCase().includes("pixverse")) {
    if (r.includes("1080") || r === "1k" || r === "pro") return "1080p";
    if (r.includes("720")) return "720p";
    if (r.includes("540")) return "540p";
    if (r.includes("360")) return "360p";
    if (r.includes("480") || r === "std") return "360p";
    return "540p";
  }

  return raw;
}

export function audioParamForMcpModel(
  mcpModel: string,
  generateAudio?: boolean,
  audioParam?: AudioParamKey | null,
): Record<string, boolean> {
  if (audioParam === null) return {};
  if (audioParam === "generateSound") {
    return { generateSound: Boolean(generateAudio) };
  }
  if (audioParam === "generateAudio") {
    return { generateAudio: Boolean(generateAudio) };
  }
  // Legacy fallback when catalog has no synced audioParam.
  if (mcpModel.includes("kling")) {
    return { generateSound: Boolean(generateAudio) };
  }
  if (
    mcpModel.includes("gemini-omni") ||
    mcpModel.includes("wan2") ||
    mcpModel.includes("grok-imagine")
  ) {
    return {};
  }
  return { generateAudio: Boolean(generateAudio) };
}
