/**
 * PixVerse V6 pricing — delegates to central {@link calculateVideoCredits}.
 * @see src/config/modelPricing.ts
 */

import {
  CREDIT_USD,
  calculateVideoCredits,
  getVideoCreditsPerSecond,
  normalizePricingQuality,
  type VideoQuality,
} from "@/config/modelPricing";
import { PIXVERSE_MODEL_ID } from "@/lib/pixverse-constants";

export type PixVerseQuality = VideoQuality;

export type PixVerseCreditBreakdown = {
  quality: PixVerseQuality;
  durationSec: number;
  creditsPerSecond: number;
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
  return normalizePricingQuality(resolution, PIXVERSE_MODEL_ID);
}

export function clampPixVerseDuration(duration?: number | null): number {
  const n = Math.round(Number(duration) || 5);
  return Math.max(1, Math.min(15, Number.isFinite(n) ? n : 5));
}

export function pixVerseCreditsPerSecond(input: {
  resolution?: string | null;
  generateAudio?: boolean;
  hasVideoReferences?: boolean;
}): number {
  return getVideoCreditsPerSecond({
    model: PIXVERSE_MODEL_ID,
    quality: input.resolution,
    hasAudio: input.generateAudio,
    hasVideoReferences: input.hasVideoReferences,
  });
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
  const hasVideoReferences = Boolean(input.hasVideoReferences);
  const generateAudio = Boolean(input.generateAudio);

  const standardPerSec = getVideoCreditsPerSecond({
    model: PIXVERSE_MODEL_ID,
    quality,
    hasAudio: generateAudio,
    hasVideoReferences: false,
  });
  const totalPerSec = getVideoCreditsPerSecond({
    model: PIXVERSE_MODEL_ID,
    quality,
    hasAudio: generateAudio,
    hasVideoReferences,
  });
  const videoRefPerSec = Math.max(0, totalPerSec - standardPerSec);
  const audioPerSec = generateAudio
    ? Math.max(
        0,
        getVideoCreditsPerSecond({
          model: PIXVERSE_MODEL_ID,
          quality,
          hasAudio: true,
          hasVideoReferences: false,
        }) -
          getVideoCreditsPerSecond({
            model: PIXVERSE_MODEL_ID,
            quality,
            hasAudio: false,
            hasVideoReferences: false,
          }),
      )
    : 0;
  const clarityPerSec = Math.max(0, standardPerSec - audioPerSec);

  const walletCredits = calculateVideoCredits({
    model: PIXVERSE_MODEL_ID,
    quality,
    hasAudio: generateAudio,
    durationInSeconds: durationSec,
    hasVideoReferences,
    videoCount: count,
  });

  const clarityCredits = clarityPerSec * durationSec * count;
  const audioCredits = audioPerSec * durationSec * count;
  const videoRefCredits = videoRefPerSec * durationSec * count;

  return {
    quality,
    durationSec,
    creditsPerSecond: totalPerSec,
    clarityCredits,
    audioCredits,
    videoRefCredits,
    apiCredits: clarityCredits + audioCredits + videoRefCredits,
    walletCredits,
    costUsd: walletCredits * CREDIT_USD,
    sellUsd: walletCredits * CREDIT_USD,
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
    `وضوح ${Math.round(breakdown.clarityCredits)}`,
    breakdown.audioCredits > 0
      ? `صوت ${Math.round(breakdown.audioCredits)}`
      : null,
    breakdown.videoRefCredits > 0
      ? `فيديو ${Math.round(breakdown.videoRefCredits)}`
      : null,
  ].filter(Boolean);
  return `PixVerse: ${parts.join(" + ")} = ${breakdown.walletCredits} كريدت (${breakdown.creditsPerSecond}/ث)`;
}
