/** Pure credit markup helpers — safe for client + server bundles. */

/** Veronix wallet credits = seeded base credits × this fixed markup. */
export const VERONIX_CREDIT_MULTIPLIER = 1.8;

/** Apply the platform markup to every model — no per-model exceptions. */
export function toVeronixCredits(openArtCredits: number): number {
  const base = Number(openArtCredits);
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.max(1, Math.round(base * VERONIX_CREDIT_MULTIPLIER));
}

export function withMultiplierNote(note?: string): string {
  const base = note?.trim();
  const tag = `Veronix price = base × ${VERONIX_CREDIT_MULTIPLIER}`;
  if (!base) return tag;
  if (
    base.includes("× 1.8") ||
    base.includes("×1.8") ||
    base.includes(String(VERONIX_CREDIT_MULTIPLIER))
  ) {
    return base;
  }
  return `${base} · ${tag}`;
}

export interface QuoteInput {
  modelId: string;
  media: "image" | "video";
  mode: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  imageCount?: number;
  videoCount?: number;
  generateAudio?: boolean;
  /** PixVerse Fusion — video_references attached (higher per-second rate). */
  hasVideoReferences?: boolean;
}

export interface QuoteResult {
  modelId: string;
  mcpModel: string;
  mode: string;
  /** Final Veronix wallet debit (OpenArt × 1.8). */
  totalCredits: number;
  unitCredits: number;
  /** Raw OpenArt credits before markup (for audit / UI transparency). */
  openArtCredits: number;
  multiplier: number;
  available: boolean;
  config: Record<string, unknown>;
  pricingNote?: string;
  source: "cache" | "estimate";
  cached?: boolean;
}
