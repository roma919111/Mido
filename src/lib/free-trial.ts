/** First-time free Veronix video: stock intro (as-is) + 4s model clip. */

export const VERONIX_MODEL_ID = "seedance-2-mini";

/**
 * Locked duration sent to OpenArt / shown in free-trial controls.
 * Branding prepends the full stock intro separately.
 */
export const FREE_VERONIX_DURATION_SECONDS = 4;

/** Seconds sent to the OpenArt model (prompt content only). */
export const FREE_VERONIX_MODEL_DURATION_SECONDS = 4;

/** Official owner stock intro (do not edit the asset — concat as-is). */
export const FREE_VERONIX_STOCK_PATH = "public/promo/vyronix-outro-stock.mp4";

/** Locked free-trial resolution. */
export const FREE_VERONIX_RESOLUTION = "480p";

export function isFreeVeronixEligible(
  user: { freeVeronixUsed?: boolean } | null | undefined,
  input: {
    modelId: string;
    media: string;
    duration?: number;
    /** Paid multi-shot / intermediate clips are never free-trial. */
    multiShot?: boolean;
    sequencePart?: boolean;
  },
): boolean {
  if (!user || user.freeVeronixUsed) return false;
  if (input.media !== "video") return false;
  if (input.modelId !== VERONIX_MODEL_ID) return false;
  // Multi-shot sequence parts are always billed (Seedance min is 4s — must not
  // look like the free single-clip trial).
  if (input.sequencePart || input.multiShot) return false;
  return Number(input.duration) === FREE_VERONIX_DURATION_SECONDS;
}
