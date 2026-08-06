import { stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { AssetRecord } from "@/lib/db";
import { previewPrepTotalMs } from "@/lib/preview-prep-eta";
import { isAllowedMediaHost } from "@/lib/media-proxy";

const POSTER_DIR = path.join(process.cwd(), ".data", "posters");

function cacheKey(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 24);
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64url");
}

function posterKeyFor(input: {
  url?: string | null;
  historyId?: string | null;
}): string | null {
  const existing = input.url?.trim();
  if (existing?.startsWith("/generations/")) return existing;
  if (existing && /^https?:\/\//i.test(existing)) {
    try {
      if (isAllowedMediaHost(new URL(existing).hostname)) {
        return toBase64Url(existing);
      }
    } catch {
      // fall through
    }
  }
  if (input.historyId?.trim()) return input.historyId.trim();
  return null;
}

/** Poster warm time ≈ when the video URL first became playable server-side. */
export async function inferCompletedAtFromPoster(asset: AssetRecord): Promise<string | null> {
  const keySrc = posterKeyFor({ url: asset.url, historyId: asset.historyId });
  if (!keySrc) return null;
  try {
    const file = path.join(POSTER_DIR, `${cacheKey(keySrc)}.jpg`);
    const s = await stat(file);
    return s.mtime.toISOString();
  } catch {
    return null;
  }
}

export type VideoReadyTiming = {
  assetId: string;
  mode: string;
  model: string;
  targetSeconds: number;
  resolution?: string;
  createdAt: string;
  completedAt: string | null;
  completedAtSource: "db" | "poster_mtime" | "unknown";
  generationSeconds: number | null;
  prepSeconds: number;
  totalUntilPlaySeconds: number | null;
};

export async function buildVideoReadyTiming(asset: AssetRecord): Promise<VideoReadyTiming> {
  const targetSeconds =
    typeof asset.targetSeconds === "number" && asset.targetSeconds > 0
      ? asset.targetSeconds
      : 5;
  const prepMs = previewPrepTotalMs({
    clarityPending:
      Boolean(asset.preferClarity) &&
      String(asset.resolution || "").toLowerCase() !== "720p",
    resolution: asset.resolution,
    targetSeconds,
  });
  const prepSeconds = Math.round(prepMs / 1000);

  let completedAt = asset.completedAt || null;
  let completedAtSource: VideoReadyTiming["completedAtSource"] = completedAt
    ? "db"
    : "unknown";

  if (!completedAt && asset.url) {
    const inferred = await inferCompletedAtFromPoster(asset);
    if (inferred) {
      completedAt = inferred;
      completedAtSource = "poster_mtime";
    }
  }

  const createdMs = Date.parse(asset.createdAt);
  const completedMs = completedAt ? Date.parse(completedAt) : NaN;
  const generationSeconds =
    Number.isFinite(createdMs) && Number.isFinite(completedMs)
      ? Math.max(0, Math.round((completedMs - createdMs) / 1000))
      : null;
  const totalUntilPlaySeconds =
    generationSeconds != null ? generationSeconds + prepSeconds : null;

  return {
    assetId: asset.id,
    mode: asset.mode,
    model: asset.model,
    targetSeconds,
    resolution: asset.resolution,
    createdAt: asset.createdAt,
    completedAt,
    completedAtSource,
    generationSeconds,
    prepSeconds,
    totalUntilPlaySeconds,
  };
}
