/** First-time free Veronix video: stock intro (as-is) + 4s model clip. */

/** Branded Vyronix video — MiniMax H3 backend. */
export const VERONIX_MODEL_ID = "vyronix";

/**
 * Locked duration sent to OpenArt / shown in free-trial controls.
 * Branding prepends the full stock intro separately.
 */
export const FREE_VERONIX_DURATION_SECONDS = 4;

/** Seconds sent to the OpenArt model (prompt content only). */
export const FREE_VERONIX_MODEL_DURATION_SECONDS = 4;

/** Official owner stock intro (do not edit the asset — concat as-is). */
export const FREE_VERONIX_STOCK_PATH = "public/promo/vyronix-outro-stock.mp4";

/** Locked free-trial resolution (MiniMax 768P tier). */
export const FREE_VERONIX_RESOLUTION = "768p";

/**
 * Free Veronix trial — once per account, only when the wallet is empty.
 * Paid users (credits > 0) are always billed, even at 4s.
 */
export function isFreeVeronixEligible(
  user: { freeVeronixUsed?: boolean; credits?: number } | null | undefined,
  input: {
    modelId: string;
    media: string;
    duration?: number;
    resolution?: string;
    /** Paid multi-shot / intermediate clips are never free-trial. */
    multiShot?: boolean;
    sequencePart?: boolean;
  },
): boolean {
  if (!user || user.freeVeronixUsed) return false;
  // Already funded → never treat a 4s clip as the one-time freebie.
  if ((user.credits ?? 0) > 0) return false;
  if (input.media !== "video") return false;
  if (input.modelId !== VERONIX_MODEL_ID) return false;
  // Multi-shot sequence parts are always billed (Seedance min is 4s — must not
  // look like the free single-clip trial).
  if (input.sequencePart || input.multiShot) return false;
  if (Number(input.duration) !== FREE_VERONIX_DURATION_SECONDS) return false;
  // Free trial is locked to 480p; any other clarity is paid.
  const res = String(input.resolution || FREE_VERONIX_RESOLUTION)
    .trim()
    .toLowerCase();
  if (res && res !== FREE_VERONIX_RESOLUTION && res !== "768p") return false;
  return true;
}
