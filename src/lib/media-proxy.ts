/**
 * Same-origin media URLs so customers never see OpenArt CDN links
 * in the address bar, download sheet, or video player source.
 */

import { stripInternalPromptNotes } from "@/lib/character-names";

const ALLOWED_HOST_SUFFIXES = [
  ".openart.ai",
  ".openart.com",
  ".bytepluses.com",
  ".byteplus.com",
  ".volces.com",
  ".pixverse.ai",
  ".pixverseai.cn",
  ".aliyuncs.com",
  ".cloudfront.net",
];

export function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "openart.ai" ||
    host === "openart.com" ||
    host === "byteplus.com" ||
    host === "bytepluses.com" ||
    host === "pixverse.ai" ||
    host === "pixverseai.cn"
  ) {
    return true;
  }
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function toBase64Url(raw: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Stable short id so stream/poster query strings don't change every render. */
function stableMediaKey(input: {
  historyId?: string | null;
  url?: string | null;
}): string {
  const key = String(input.historyId || input.url || "media");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildMediaApiPath(
  input: {
    historyId?: string | null;
    url?: string | null;
    mediaType?: "image" | "video";
  },
  mode: "download" | "stream" | "poster",
): string | null {
  const mediaType = input.mediaType || "video";
  const ext = mediaType === "video" ? "mp4" : "png";
  /**
   * Stream/poster URLs MUST be stable across React re-renders.
   * Using Date.now() made `<video src>` change every setState → browser
   * restarted playback every ~2s while buffering (looked like a load loop).
   * Downloads can stay unique for the save-as filename.
   */
  const filename =
    mode === "download"
      ? `veronix-${Date.now()}.${ext}`
      : `veronix-${stableMediaKey(input)}.${ext}`;
  const endpoint =
    mode === "download"
      ? "/api/media/download"
      : mode === "poster"
        ? "/api/media/poster"
        : "/api/media/stream";

  const historyId = input.historyId?.trim();
  const existing = input.url?.trim();
  // Stitched verb-chain files live under `.data/generations`. Prefer them over
  // pv:/bp: historyId — those ids often point at the LAST clip only, so the
  // player would play 4s while the UI still shows 16s/30s.
  if (existing?.startsWith("/generations/")) {
    const qs = new URLSearchParams({
      local: existing,
      type: mediaType,
      filename,
    });
    return `${endpoint}?${qs.toString()}`;
  }

  // Remote provider tasks: resolve via historyId (fresh CDN URL). Stale `url`
  // in the DB often 404s on PixVerse/BytePlus for stream + poster extraction.
  if (
    historyId &&
    (historyId.startsWith("pv:") || historyId.startsWith("bp:")) &&
    (mode === "poster" || mode === "stream")
  ) {
    const qs = new URLSearchParams({
      historyId,
      type: mediaType,
      filename,
    });
    return `${endpoint}?${qs.toString()}`;
  }

  // Prefer direct CDN/local URL over historyId — avoids a BytePlus task lookup
  // on every poster/stream request (multi-second cold start on Assets).
  const raw = existing || "";
  if (raw) {
    // Absolute same-origin paths (already Veronix).
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      if (mode === "stream") return raw;
      if (mode === "poster") return null;
      return null;
    }

    try {
      const parsed = new URL(raw);
      if (isAllowedMediaHost(parsed.hostname)) {
        const qs = new URLSearchParams({
          u: toBase64Url(raw),
          type: mediaType,
          filename,
        });
        return `${endpoint}?${qs.toString()}`;
      }
    } catch {
      // fall through to historyId
    }
  }

  if (input.historyId?.trim()) {
    const qs = new URLSearchParams({
      historyId: input.historyId.trim(),
      type: mediaType,
      filename,
    });
    return `${endpoint}?${qs.toString()}`;
  }

  return null;
}

/** Force-download through Veronix with a Veronix filename. */
export function veronixDownloadPath(input: {
  historyId?: string | null;
  url?: string | null;
  mediaType?: "image" | "video";
}): string | null {
  return buildMediaApiPath(input, "download");
}

/** Playback / preview source.
 * Videos always stream through Veronix (Range, auth, CDN refresh).
 * Images may load allowed CDN URLs directly.
 */
export function veronixMediaSrc(input: {
  historyId?: string | null;
  url?: string | null;
  mediaType?: "image" | "video";
}): string | null {
  const mediaType = input.mediaType || "video";
  const raw = input.url?.trim() || "";

  if (mediaType === "video") {
    return buildMediaApiPath(input, "stream") || raw || null;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      if (isAllowedMediaHost(new URL(raw).hostname)) return raw;
    } catch {
      // fall through to proxy
    }
  }
  return buildMediaApiPath(input, "stream") || raw || null;
}

/** First-frame JPEG poster for video tiles / feed. */
export function veronixPosterSrc(input: {
  historyId?: string | null;
  url?: string | null;
}): string | null {
  return buildMediaApiPath({ ...input, mediaType: "video" }, "poster");
}

/**
 * Display / hydrate URL for a character still.
 * Local `/generations/*` files are not public — always go through the stream proxy.
 */
export function veronixRefImageSrc(url: string | null | undefined): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/generations/")) {
    const qs = new URLSearchParams({ local: raw, type: "image" });
    return `/api/media/stream?${qs.toString()}`;
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return null;
}

/** Strip internal multi-shot / ETA / binding tags from the customer-facing prompt. */
export function cleanAssetPrompt(prompt: string | undefined | null): string {
  if (!prompt) return "";
  return stripInternalPromptNotes(prompt)
    .replace(/\n?Beat \d+ of \d+[^\n]*/gi, "")
    .replace(/\n?one shot only[^\n]*/gi, "")
    .replace(/\n?Continuation beat[^\n]*/gi, "")
    .trim();
}

/**
 * Short creative title derived from the generation prompt
 * (first sentence / clause, trimmed for the Assets feed).
 */
export function assetPromptTitle(prompt: string | undefined | null): string {
  const clean = cleanAssetPrompt(prompt);
  if (!clean) return "إبداع Veronix";
  const firstLine = clean.split(/\n+/)[0]?.trim() || clean;
  const clause =
    firstLine.split(/(?<=[.!?؟…])\s+|[,،;:]\s+/)[0]?.trim() || firstLine;
  const title = clause.replace(/^["'«]+|["'»]+$/g, "").trim();
  if (title.length <= 52) return title || "إبداع Veronix";
  return `${title.slice(0, 50).trim()}…`;
}
