/** First-time free Veronix video grant (9 seconds). */

export const VERONIX_MODEL_ID = "seedance-2-mini";
export const FREE_VERONIX_DURATION_SECONDS = 9;

export function isFreeVeronixEligible(
  user: { freeVeronixUsed?: boolean } | null | undefined,
  input: { modelId: string; media: string; duration?: number },
): boolean {
  if (!user || user.freeVeronixUsed) return false;
  if (input.media !== "video") return false;
  if (input.modelId !== VERONIX_MODEL_ID) return false;
  return Number(input.duration) === FREE_VERONIX_DURATION_SECONDS;
}
