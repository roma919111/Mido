/** Post-generate prep window before Play (measured PixVerse ~55s wall clock). */
export const PREVIEW_PREP_VIDEO_MS = 55_000;

/** Clarity pipeline base (download + ffmpeg startup). */
const CLARITY_BASE_MS = 15_000;

/** Per output second — scales with pixel load (360p lightest). */
const CLARITY_MS_PER_SECOND: Record<string, number> = {
  "360": 500,
  "480": 700,
  "540": 850,
  "720": 1000,
  "1080": 1500,
};

function clarityMsPerSecond(resolution?: string): number {
  const res = String(resolution || "480p").toLowerCase();
  for (const [key, ms] of Object.entries(CLARITY_MS_PER_SECOND)) {
    if (res.includes(key)) return ms;
  }
  return CLARITY_MS_PER_SECOND["480"]!;
}

/** Estimated clarity prep time: 15s base + resolution-weighted encode per clip second. */
export function estimateClarityPrepMs(
  resolution: string | undefined,
  targetSeconds: number | undefined,
): number {
  const sec = Math.max(4, Math.min(15, targetSeconds ?? 5));
  return CLARITY_BASE_MS + Math.round(sec * clarityMsPerSecond(resolution));
}

export function previewPrepTotalMs(input: {
  clarityPending?: boolean;
  resolution?: string;
  targetSeconds?: number;
}): number {
  let total = PREVIEW_PREP_VIDEO_MS;
  if (input.clarityPending) {
    total += estimateClarityPrepMs(input.resolution, input.targetSeconds);
  }
  return total;
}

export function previewPrepRemainingMs(
  completedAt: number | undefined,
  input: {
    clarityPending?: boolean;
    resolution?: string;
    targetSeconds?: number;
  },
  nowMs = Date.now(),
): number {
  if (!completedAt || completedAt <= 0) return PREVIEW_PREP_VIDEO_MS;
  const total = previewPrepTotalMs(input);
  return Math.max(0, completedAt + total - nowMs);
}
