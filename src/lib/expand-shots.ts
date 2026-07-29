/**
 * Expand / trim planned action shots to match the customer's duration budget.
 * 32s → 8 beats of 4s. If enhance only found 2 actions, continue/subdivide
 * so we still generate the full length and stitch one video.
 */

import { PRODUCT_PER_SHOT_SECONDS } from "@/lib/shot-plan";

export type ActionShot = { prompt: string; action: string };

export function shotBudgetFromDuration(durationSec: number, maxShots = 8): number {
  return Math.max(
    1,
    Math.min(
      maxShots,
      Math.floor(
        Math.max(PRODUCT_PER_SHOT_SECONDS, durationSec) / PRODUCT_PER_SHOT_SECONDS,
      ),
    ),
  );
}

/**
 * Ensure we have exactly `budget` shots for generation.
 * - Too many → keep first N
 * - Too few → continue each action as "continues / next beat" until budget filled
 */
export function expandShotsToBudget(
  shots: ActionShot[],
  budget: number,
): ActionShot[] {
  const n = Math.max(1, Math.round(budget));
  if (!shots.length) {
    return Array.from({ length: n }, (_, i) => ({
      action: `beat ${i + 1}`,
      prompt: `Cinematic semi-realistic continuation beat ${i + 1} of ${n}. One shot only.`,
    }));
  }
  if (shots.length >= n) return shots.slice(0, n);

  const out: ActionShot[] = shots.map((s) => ({ ...s }));
  let i = 0;
  while (out.length < n) {
    const src = shots[i % shots.length]!;
    const beat = out.length + 1;
    out.push({
      action: `${src.action} (continues)`,
      prompt: [
        src.prompt.trim(),
        `Continuation beat ${beat} of ${n}: keep the same characters, wardrobe, and setting.`,
        "Advance the same action naturally — one primary motion only, seamless continuity from the previous beat.",
        "one shot only, perform this action without adding events from other shots",
      ].join(" "),
    });
    i += 1;
  }
  return out;
}
