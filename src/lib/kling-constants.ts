/** Client-safe Kling 3.0 Omni constants. */
export const KLING_OMNI_MODEL_ID = "kling-3-omni";
export const KLING_OMNI_MCP_ID = "kling-3-omni";
export const KLING_TASK_PREFIX = "kl:";

/** Server-side wait for async Kling video jobs. */
export const KLING_JOB_TIMEOUT_MS = 30 * 60 * 1000;
export const KLING_UI_TIMEOUT_MS = KLING_JOB_TIMEOUT_MS;
export const KLING_HARD_FAIL_MS = 60 * 60 * 1000;
export const KLING_POLL_INTERVAL_MS = 8_000;
export const KLING_RECOVER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Official Kling platform list prices (USD per output second).
 * Source: Kling API pricing — 720p/1080p; 4K estimated conservatively.
 */
export const KLING_OMNI_OUTPUT_USD_PER_SEC = {
  "720p": { noAudio: 0.1, withAudio: 0.15 },
  "1080p": { noAudio: 0.15, withAudio: 0.2 },
  "4k": { noAudio: 0.35, withAudio: 0.42 },
} as const;

export type KlingOmniQuality = keyof typeof KLING_OMNI_OUTPUT_USD_PER_SEC;
