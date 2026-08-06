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
export const GEMINI_AUDIO_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;
