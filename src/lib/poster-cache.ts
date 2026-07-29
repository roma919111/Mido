/**
 * Pre-warm video posters under `.data/posters` so Assets does not
 * extract a frame on first open (same keys as /api/media/poster).
 */

import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAllowedMediaHost } from "@/lib/media-proxy";
import { resolveGenerationFile } from "@/lib/veronix-outro";
import { extractFirstFrameJpeg } from "@/lib/video-stitch";

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

function resolveSource(input: {
  url?: string | null;
  historyId?: string | null;
}): string | null {
  const existing = input.url?.trim();
  if (existing?.startsWith("/generations/")) {
    const filePath = resolveGenerationFile(existing);
    return filePath ? `file://${filePath}` : null;
  }
  if (existing && /^https?:\/\//i.test(existing)) {
    try {
      if (isAllowedMediaHost(new URL(existing).hostname)) return existing;
    } catch {
      return null;
    }
  }
  return null;
}

/** Fire-and-forget safe: never throws to callers. */
export async function warmVideoPoster(input: {
  url?: string | null;
  historyId?: string | null;
}): Promise<boolean> {
  try {
    const keySrc = posterKeyFor(input);
    const source = resolveSource(input);
    if (!keySrc || !source) return false;

    await mkdir(POSTER_DIR, { recursive: true });
    const file = path.join(POSTER_DIR, `${cacheKey(keySrc)}.jpg`);
    try {
      await access(file);
      return true; // already cached
    } catch {
      // generate
    }

    const jpeg = await extractFirstFrameJpeg(source);
    await writeFile(file, jpeg);
    return true;
  } catch (err) {
    console.warn(
      "[veronix] poster warm failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** Non-blocking warm for generate/status completion paths. */
export function warmVideoPosterBackground(input: {
  url?: string | null;
  historyId?: string | null;
}): void {
  void warmVideoPoster(input);
}
