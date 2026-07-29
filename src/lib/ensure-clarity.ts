/**
 * Ensure a visible Assets video has the free clarity upscale applied.
 * Intermediate sequence-part beats stay raw (stitch applies clarity on concat).
 */

import { cacheVideoLocally } from "@/lib/video-stitch";

export function needsClarityGrade(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  // Already graded local files
  if (/^\/generations\/grade-/i.test(u)) return false;
  // Concat finals from clarity path often use concat- prefix — still may need grade
  // if they were saved without clarity. Prefer grading remote CDN always.
  if (/^https?:\/\//i.test(u)) return true;
  if (/^\/generations\/part-/i.test(u)) return true;
  if (/^\/generations\//i.test(u) && !/grade-/i.test(u)) return true;
  return false;
}

/**
 * Free clarity upgrade is 480→~720 only.
 * Native 720p already meets the target — re-encoding it hung status/Assets sync
 * and looked like "720p clarity always fails".
 */
export function shouldApplyClarityGrade(input: {
  preferClarity?: boolean | null;
  resolution?: string | null;
  mode?: string | null;
}): boolean {
  if (!input.preferClarity) return false;
  if (input.mode === "sequence-part") return false;
  if (String(input.resolution || "").trim().toLowerCase() === "720p") {
    return false;
  }
  return true;
}

/**
 * Grade a completed visible video URL. On failure returns the original URL.
 * Never throws — callers must stay non-blocking (status / Assets polls).
 */
export async function ensureClarityUrl(
  url: string,
  opts?: { skip?: boolean },
): Promise<string> {
  if (opts?.skip) return url;
  if (!needsClarityGrade(url)) return url;
  try {
    return await cacheVideoLocally(url, { clarity: true });
  } catch (err) {
    console.warn(
      "[veronix] clarity grade skipped:",
      err instanceof Error ? err.message : err,
    );
    return url;
  }
}
