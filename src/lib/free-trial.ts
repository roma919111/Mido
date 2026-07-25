/** First-time free Veronix video: 4s model + 2s branded outro = 6s total. */

export const VERONIX_MODEL_ID = "seedance-2-mini";

/** Final customer-facing length (model clip + VYRONIX outro). */
export const FREE_VERONIX_DURATION_SECONDS = 6;

/** Seconds sent to the OpenArt model (prompt content only). */
export const FREE_VERONIX_MODEL_DURATION_SECONDS = 4;

/** Local cinematic VYRONIX end card length. */
export const FREE_VERONIX_OUTRO_SECONDS = 2;

/** Locked free-trial resolution. */
export const FREE_VERONIX_RESOLUTION = "480p";

export function isFreeVeronixEligible(
  user: { freeVeronixUsed?: boolean } | null | undefined,
  input: { modelId: string; media: string; duration?: number },
): boolean {
  if (!user || user.freeVeronixUsed) return false;
  if (input.media !== "video") return false;
  if (input.modelId !== VERONIX_MODEL_ID) return false;
  return Number(input.duration) === FREE_VERONIX_DURATION_SECONDS;
}
