/** Client-safe PixVerse constants (no Node imports). */
export const PIXVERSE_MODEL_ID = "pixverse-v6";
export const PIXVERSE_TASK_PREFIX = "pv:";

/** Official PixVerse V6 API cap per request. */
export const PIXVERSE_NATIVE_MAX_DURATION = 15;
/**
 * Site experiment: chain two native 15s clips via PixVerse extend API up to 30s.
 * Set false to revert the UI/quote cap to 15s without deleting the chain code.
 */
export const PIXVERSE_DURATION_EXTEND_ENABLED = true;
export const PIXVERSE_EXTEND_MAX_DURATION = 30;

export function pixverseDurationMax(): number {
  return PIXVERSE_DURATION_EXTEND_ENABLED
    ? PIXVERSE_EXTEND_MAX_DURATION
    : PIXVERSE_NATIVE_MAX_DURATION;
}

/** Your PixVerse pack: $10 = 2,000 provider credits. */
export const PIXVERSE_PACK_USD = 10;
export const PIXVERSE_PACK_CREDITS = 2_000;
/** $10 ÷ 2,000 = $0.005 per PixVerse credit. */
export const PIXVERSE_USD_PER_API_CREDIT =
  PIXVERSE_PACK_USD / PIXVERSE_PACK_CREDITS;

export type PixVerseApiQuality = "360p" | "540p" | "720p" | "1080p";

/**
 * Official V6 API credits per output second.
 * Fusion with video_references is a separate ~2× table, not a small add-on.
 * Source: https://docs.platform.pixverse.ai/pricing-796039m0
 */
export const PIXVERSE_API_CREDITS_PER_SEC: Record<
  PixVerseApiQuality,
  {
    noAudio: number;
    withAudio: number;
    noAudioVideoRef: number;
    withAudioVideoRef: number;
  }
> = {
  "360p": { noAudio: 5, withAudio: 7, noAudioVideoRef: 10, withAudioVideoRef: 14 },
  "540p": { noAudio: 7, withAudio: 9, noAudioVideoRef: 14, withAudioVideoRef: 18 },
  "720p": { noAudio: 9, withAudio: 12, noAudioVideoRef: 18, withAudioVideoRef: 24 },
  "1080p": { noAudio: 18, withAudio: 23, noAudioVideoRef: 36, withAudioVideoRef: 46 },
};

export function lookupPixverseApiCreditsPerSec(input: {
  quality?: string | null;
  generateAudio?: boolean | null;
  hasVideoReferences?: boolean | null;
}): number {
  const r = String(input.quality || "540p").trim().toLowerCase();
  const quality: PixVerseApiQuality =
    r.includes("1080") || r === "1k" || r === "pro"
      ? "1080p"
      : r.includes("720")
        ? "720p"
        : r.includes("360")
          ? "360p"
          : "540p";
  const row = PIXVERSE_API_CREDITS_PER_SEC[quality];
  if (input.hasVideoReferences) {
    return input.generateAudio ? row.withAudioVideoRef : row.noAudioVideoRef;
  }
  return input.generateAudio ? row.withAudio : row.noAudio;
}

