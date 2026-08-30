/**
 * Vyronix / MiniMax H3 shot timing — always aligned with model-native duration bounds.
 * Per-shot length must never be derived by dividing total ÷ shot count.
 */

import {
  MINIMAX_H3_DURATION_DEFAULT,
  MINIMAX_H3_DURATION_MAX,
  MINIMAX_H3_DURATION_MIN,
} from "@/lib/minimax-constants";

/** Native per-shot cap for MiniMax H3 (API max). */
export const VYRONIX_MODEL_SHOT_SECONDS = MINIMAX_H3_DURATION_MAX;

export function clampVyronixShotSeconds(value?: number | null): number {
  const n = Math.round(Number(value) || MINIMAX_H3_DURATION_DEFAULT);
  return Math.max(
    MINIMAX_H3_DURATION_MIN,
    Math.min(
      MINIMAX_H3_DURATION_MAX,
      Number.isFinite(n) ? n : MINIMAX_H3_DURATION_DEFAULT,
    ),
  );
}

/**
 * Count shots from the prompt.
 * - Auto: each non-empty paragraph = one shot.
 * - Manual: blank line between paragraphs adds shots (same rule, auto flag only affects UI copy).
 */
export function countVyronixPromptShots(prompt: string): number {
  const body = (prompt || "").trim();
  if (!body) return 1;
  const paragraphs = body
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Math.max(1, Math.min(8, paragraphs.length || 1));
}

export function vyronixShotTiming(input: {
  prompt: string;
  perShotSeconds: number;
}): {
  perShotSeconds: number;
  shotCount: number;
  totalSeconds: number;
} {
  const perShotSeconds = clampVyronixShotSeconds(input.perShotSeconds);
  const shotCount = countVyronixPromptShots(input.prompt);
  return {
    perShotSeconds,
    shotCount,
    totalSeconds: perShotSeconds * shotCount,
  };
}
