/** Client-safe Black Forest Labs FLUX 3 video constants. */
export const FLUX_VIDEO_MODEL_ID = "flux-3-video";
export const FLUX_VIDEO_MCP_ID = "flux-3-video";
export const FLUX_TASK_PREFIX = "bfl:";

export const FLUX_JOB_TIMEOUT_MS = 30 * 60 * 1000;
export const FLUX_HARD_FAIL_MS = 60 * 60 * 1000;
export const FLUX_POLL_INTERVAL_MS = 8_000;
export const FLUX_RECOVER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Official BFL FLUX 3 list prices (USD per output second).
 * Audio is included. Draft is HD-only.
 * Source: https://docs.bfl.ai/quick_start/pricing
 */
export const FLUX_VIDEO_USD_PER_SEC = {
  t2v: { draft: 0.06, hd: 0.17, fhd: 0.29 },
  i2v: { draft: 0.06, hd: 0.17, fhd: 0.29 },
  v2v: { draft: 0.12, hd: 0.43, fhd: 0.54 },
} as const;

export type FluxVideoQuality = "draft" | "hd" | "fhd";
export type FluxVideoMode = keyof typeof FLUX_VIDEO_USD_PER_SEC;
