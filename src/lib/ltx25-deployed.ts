/** LTX 2.5 multi-subject HF Space (AI Rental Studio default video model). */

export const VERONIX_DEPLOYED_MODEL_ID = "vyronix-deployed";

export const LTX25_DURATION_DEFAULT = 4;
export const LTX25_DURATION_MIN = 1;
export const LTX25_DURATION_MAX = 8;
export const LTX25_DURATION_STEP = 0.5;

export const LTX25_RENTAL_DEFAULT_RESOLUTION = "704 × 1280 · 9:16 portrait";
export const LTX25_RENTAL_RESOLUTION_STORAGE_KEY = "vyronix-ltx-resolution";

export const LTX25_RESOLUTION_OPTIONS = [
  "1280 × 704 · 16:9",
  "1664 × 960 · 16:9 (workflow, slower)",
  "704 × 1280 · 9:16 portrait",
  "960 × 960 · 1:1",
] as const;

export function isVyronixDeployedModel(modelId: string | null | undefined): boolean {
  return String(modelId || "").trim().toLowerCase() === VERONIX_DEPLOYED_MODEL_ID;
}

export function snapLtx25DurationSeconds(value: number): number {
  if (!Number.isFinite(value)) return LTX25_DURATION_DEFAULT;
  const snapped = Math.round((Math.round(value / LTX25_DURATION_STEP) * LTX25_DURATION_STEP) * 10) / 10;
  return Math.min(LTX25_DURATION_MAX, Math.max(LTX25_DURATION_MIN, snapped));
}
