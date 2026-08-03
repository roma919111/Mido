/**
 * PixVerse V6 pricing — official API credit table decomposed by category.
 * @see https://docs.platform.pixverse.ai/pricing-796039m0
 *
 * Wallet debit = (clarity + audio + videoRef) PixVerse credits × 1 × 1.55 each
 * — no extra ×1.8 multiplier; 55% profit on every category.
 */

import { VERONIX_PROFIT_MARKUP, withProfitMarkup } from "@/lib/byteplus-pricing";
import { PIXVERSE_MODEL_ID } from "@/lib/pixverse-constants";

/** Pay-as-you-go: $10 → 1,000 PixVerse API credits (for margin audit only). */
export const PIXVERSE_CREDIT_USD = 0.01;

export type PixVerseQuality = "360p" | "540p" | "720p" | "1080p";

/** V6 standard — clarity base (no audio, no video ref). Credits / second. */
const V6_CLARITY: Record<PixVerseQuality, number> = {
  "360p": 5,
  "540p": 7,
  "720p": 9,
  "1080p": 18,
};

/** Extra audio premium / second (standard path). */
const V6_AUDIO_EXTRA: Record<PixVerseQuality, number> = {
  "360p": 2,
  "540p": 2,
  "720p": 3,
  "1080p": 5,
};

/** Extra video-reference premium / second (Fusion + video_references). */
const V6_VIDEO_REF_EXTRA: Record<PixVerseQuality, number> = {
  "360p": 5,
  "540p": 7,
  "720p": 9,
  "1080p": 18,
};

/** Fusion path — extra audio premium / second when video refs are attached. */
const V6_FUSION_AUDIO_EXTRA: Record<PixVerseQuality, number> = {
  "360p": 4,
  "540p": 4,
  "720p": 6,
  "1080p": 10,
};

export type PixVerseCreditBreakdown = {
  quality: PixVerseQuality;
  durationSec: number;
  clarityCredits: number;
  audioCredits: number;
  videoRefCredits: number;
  apiCredits: number;
  walletCredits: number;
  sellUsd: number;
  costUsd: number;
};

export function normalizePixVerseQuality(
  resolution?: string | null,
): PixVerseQuality {
  const r = String(resolution || "540p").trim().toLowerCase();
  if (r === "360p" || r.includes("360")) return "360p";
  if (r === "540p" || r.includes("540")) return "540p";
  if (r === "720p" || r.includes("720")) return "720p";
  if (r === "1080p" || r.includes("1080") || r === "1k" || r === "pro") {
    return "1080p";
  }
  // Veronix UI uses 480p — nearest PixVerse tier is 360p.
  if (r.includes("480") || r === "std") return "360p";
  return "540p";
}

export function clampPixVerseDuration(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(1, Math.min(15, Number.isFinite(n) ? n : 5));
}

export function pixVerseCreditsPerSecondBreakdown(input: {
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
}): { clarity: number; audio: number; videoRef: number } {
  const quality = normalizePixVerseQuality(input.resolution);
  const clarity = V6_CLARITY[quality];
  const videoRef = input.hasVideoReferences ? V6_VIDEO_REF_EXTRA[quality] : 0;
  let audio = 0;
  if (input.generateAudio) {
    audio = input.hasVideoReferences
      ? V6_FUSION_AUDIO_EXTRA[quality]
      : V6_AUDIO_EXTRA[quality];
  }
  return { clarity, audio, videoRef };
}

export function pixVerseApiCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
  videoCount?: number;
}): number {
  const duration = clampPixVerseDuration(input.duration);
  const perSec = pixVerseCreditsPerSecondBreakdown(input);
  const perClip =
    (perSec.clarity + perSec.audio + perSec.videoRef) * duration;
  return perClip * Math.max(1, input.videoCount ?? 1);
}

export function pixVerseCostUsd(input: {
  duration?: number | null;
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
  videoCount?: number;
}): number {
  return pixVerseApiCredits(input) * PIXVERSE_CREDIT_USD;
}

export function quotePixVerseVideoBreakdown(input: {
  duration?: number | null;
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
  videoCount?: number;
}): PixVerseCreditBreakdown {
  const quality = normalizePixVerseQuality(input.resolution);
  const durationSec = clampPixVerseDuration(input.duration);
  const count = Math.max(1, input.videoCount ?? 1);
  const perSec = pixVerseCreditsPerSecondBreakdown(input);

  const clarityCredits = perSec.clarity * durationSec * count;
  const audioCredits = perSec.audio * durationSec * count;
  const videoRefCredits = perSec.videoRef * durationSec * count;
  const apiCredits = clarityCredits + audioCredits + videoRefCredits;

  const walletCredits = Math.max(
    1,
    Math.round(withProfitMarkup(clarityCredits)) +
      Math.round(withProfitMarkup(audioCredits)) +
      Math.round(withProfitMarkup(videoRefCredits)),
  );

  return {
    quality,
    durationSec,
    clarityCredits,
    audioCredits,
    videoRefCredits,
    apiCredits,
    walletCredits,
    costUsd: apiCredits * PIXVERSE_CREDIT_USD,
    sellUsd: walletCredits * PIXVERSE_CREDIT_USD,
  };
}

export function quotePixVerseVideoCredits(input: {
  duration?: number | null;
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
  videoCount?: number;
}): number {
  return quotePixVerseVideoBreakdown(input).walletCredits;
}

export function pixVerseCreditsPerSecond(input: {
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
}): number {
  const perSec = pixVerseCreditsPerSecondBreakdown(input);
  return perSec.clarity + perSec.audio + perSec.videoRef;
}

export function isPixVerseModel(
  modelId?: string | null,
  mcpModel?: string | null,
): boolean {
  const id = String(modelId || "").toLowerCase();
  const mcp = String(mcpModel || "").toLowerCase();
  return id === PIXVERSE_MODEL_ID || id === "pixverse-v6" || mcp.includes("pixverse");
}

export function formatPixVersePricingNote(
  breakdown: PixVerseCreditBreakdown,
): string {
  const parts = [
    `وضوح ${breakdown.clarityCredits}×${VERONIX_PROFIT_MARKUP}`,
    breakdown.audioCredits > 0
      ? `صوت ${breakdown.audioCredits}×${VERONIX_PROFIT_MARKUP}`
      : null,
    breakdown.videoRefCredits > 0
      ? `فيديو ${breakdown.videoRefCredits}×${VERONIX_PROFIT_MARKUP}`
      : null,
  ].filter(Boolean);
  return `PixVerse: ${parts.join(" + ")} = ${breakdown.walletCredits} كريدت (تكلفة API ~$${breakdown.costUsd.toFixed(2)})`;
}
