/** Client-safe MiniMax H3 constants. */
export const MINIMAX_H3_MODEL_ID = "minimax-h3";
export const MINIMAX_H3_MCP_ID = "minimax-h3";
export const MINIMAX_H3_API_MODEL = "MiniMax-H3";
export const MINIMAX_TASK_PREFIX = "mm:";

/** Server-side wait for async MiniMax video jobs. */
export const MINIMAX_JOB_TIMEOUT_MS = 45 * 60 * 1000;
/** UI / client wall — matches server soft timeout. */
export const MINIMAX_UI_TIMEOUT_MS = MINIMAX_JOB_TIMEOUT_MS;
/** Absolute server fail only after this (MiniMax can exceed 30 min). */
export const MINIMAX_HARD_FAIL_MS = 90 * 60 * 1000;
export const MINIMAX_POLL_INTERVAL_MS = 10_000;
/** Re-check falsely failed MiniMax assets for up to 7 days. */
export const MINIMAX_RECOVER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Official platform list prices (USD) — platform.minimax.io API pricing. */
export const MINIMAX_H3_OUTPUT_USD_PER_SEC = {
  "768p": 0.08,
  "2k": 0.13,
} as const;

export type MiniMaxH3Quality = keyof typeof MINIMAX_H3_OUTPUT_USD_PER_SEC;

/** Input material — first 5 reference images free, then billed each. */
export const MINIMAX_H3_FREE_REFERENCE_IMAGES = 5;
export const MINIMAX_H3_EXTRA_IMAGE_USD = 0.04;

/** MiniMax H3 API duration window — single source of truth for UI + clamp. */
export const MINIMAX_H3_DURATION_MIN = 1;
export const MINIMAX_H3_DURATION_MAX = 15;
export const MINIMAX_H3_DURATION_DEFAULT = 5;
