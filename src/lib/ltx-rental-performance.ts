/**
 * AI Rental Studio — LTX (HF Space multi-subject) latency policy.
 *
 * On vyronix.app, Generate was ~100s+ while HF Space alone ~62s because:
 * 1) Every Generate ran Claude Director first (rentalLtxOnly path).
 * 2) UI waited for full server persist before treating the clip as done.
 *
 * Wire this in CreateStudio / H3LabClient: call shouldSkipMandatoryDirectorOnGenerate
 * and use prepareLtxRentalPromptForSpace when true.
 */

import { applyDirectorSensitiveReplacements } from "@/lib/director-sensitive";

export function shouldSkipMandatoryDirectorOnGenerate(opts: {
  rentalLtxOnly: boolean;
  isLtxDeployedVideo: boolean;
  /** User tapped optional Director / Gemini enhance — not plain Generate. */
  optionalDirectorRequested: boolean;
}): boolean {
  if (!opts.rentalLtxOnly || !opts.isLtxDeployedVideo) return false;
  return !opts.optionalDirectorRequested;
}

/** Fast path: sensitive-word swap only — no Claude round-trip. */
export function prepareLtxRentalPromptForSpace(rawPrompt: string): string {
  return applyDirectorSensitiveReplacements(rawPrompt.trim());
}
