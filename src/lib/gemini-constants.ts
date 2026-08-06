/** Client-safe Gemini Omni Flash video constants. */
export const GEMINI_OMNI_FLASH_MODEL_ID = "gemini-omni-flash";
export const GEMINI_OMNI_FLASH_API_MODEL = "gemini-omni-flash-preview";
export const GEMINI_TASK_PREFIX = "gm:";

/** Server-side wait for background Gemini jobs (Google can take 5–15 min). */
export const GEMINI_JOB_TIMEOUT_MS = 20 * 60 * 1000;
export const GEMINI_POLL_INTERVAL_MS = 8_000;

/** Official list price — ~$0.10 / second of output video (Gemini API). */
export const GEMINI_VIDEO_USD_PER_SEC = 0.1;

/** Models that accept audio via generateContent (multimodal). Do NOT use vision-only/lite aliases here. */
export const GEMINI_AUDIO_MODEL_DEFAULT = "gemini-3.5-flash";
export const GEMINI_TEXT_MODEL_DEFAULT = "gemini-2.5-flash";
export const GEMINI_VISION_MODEL_DEFAULT = "gemini-flash-lite-latest";

/** Deprecated Google model ids → current replacements. */
const DEPRECATED_GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-lite": "gemini-flash-lite-latest",
  "gemini-2.0-flash-exp": "gemini-2.5-flash",
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-2.5-flash",
};

export function normalizeGeminiModelId(model: string): string {
  const trimmed = model.trim().replace(/^models\//i, "");
  if (!trimmed) return GEMINI_AUDIO_MODEL_DEFAULT;
  return DEPRECATED_GEMINI_MODEL_ALIASES[trimmed] ?? trimmed;
}

export function resolveGeminiAudioModel(): string {
  const fromEnv = process.env.GEMINI_AUDIO_MODEL?.trim();
  return normalizeGeminiModelId(fromEnv || GEMINI_AUDIO_MODEL_DEFAULT);
}

export function resolveGeminiTextModel(): string {
  const fromEnv =
    process.env.GEMINI_TEXT_MODEL?.trim() ||
    process.env.GEMINI_AUDIO_MODEL?.trim();
  return normalizeGeminiModelId(fromEnv || GEMINI_TEXT_MODEL_DEFAULT);
}

export function resolveGeminiVisionModel(): string {
  const fromEnv = process.env.GEMINI_VISION_MODEL?.trim();
  return normalizeGeminiModelId(fromEnv || GEMINI_VISION_MODEL_DEFAULT);
}

export function geminiAudioModelCandidates(): string[] {
  const primary = resolveGeminiAudioModel();
  const fallbacks = GEMINI_AUDIO_MODEL_FALLBACKS.map(normalizeGeminiModelId);
  return [...new Set([primary, ...fallbacks.filter((m) => m !== primary)])];
}

export const GEMINI_AUDIO_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
] as const;
