/**
 * Same-origin media URLs so customers never see OpenArt CDN links
 * in the address bar, download sheet, or video player source.
 */

const ALLOWED_HOST_SUFFIXES = [
  ".openart.ai",
  ".openart.com",
  ".bytepluses.com",
  ".byteplus.com",
  ".volces.com",
];

export function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "openart.ai" ||
    host === "openart.com" ||
    host === "byteplus.com" ||
    host === "bytepluses.com"
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
  const filename = `veronix-${Date.now()}.${ext}`;
  const endpoint =
    mode === "download"
      ? "/api/media/download"
      : mode === "poster"
        ? "/api/media/poster"
        : "/api/media/stream";

  const existing = input.url?.trim();
  // Branded files live under `.data/generations` — always proxy (never raw /generations).
  if (existing?.startsWith("/generations/")) {
    const qs = new URLSearchParams({
      local: existing,
      type: mediaType,
      filename,
    });
    return `${endpoint}?${qs.toString()}`;
  }

  if (input.historyId?.trim()) {
    const qs = new URLSearchParams({
      historyId: input.historyId.trim(),
      type: mediaType,
      filename,
    });
    return `${endpoint}?${qs.toString()}`;
  }

  const raw = input.url?.trim();
  if (!raw) return null;

  // Absolute same-origin paths (already Veronix).
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    if (mode === "stream") return raw;
    if (mode === "poster") return null;
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (!isAllowedMediaHost(parsed.hostname)) {
      // Non-OpenArt absolute URL: use as-is for stream only if same site later.
      return null;
    }
  } catch {
    return null;
  }

  const qs = new URLSearchParams({
    u: toBase64Url(raw),
    type: mediaType,
    filename,
  });
  return `${endpoint}?${qs.toString()}`;
}

/** Force-download through Veronix with a Veronix filename. */
export function veronixDownloadPath(input: {
  historyId?: string | null;
  url?: string | null;
  mediaType?: "image" | "video";
}): string | null {
  return buildMediaApiPath(input, "download");
}

/** Playback / preview source through Veronix (hides OpenArt CDN). */
export function veronixMediaSrc(input: {
  historyId?: string | null;
  url?: string | null;
  mediaType?: "image" | "video";
}): string | null {
  const raw = input.url?.trim() || "";
  // Images: load BytePlus/CDN URLs directly — mobile-stable (avoids long proxy streams).
  if (input.mediaType === "image" && /^https?:\/\//i.test(raw)) {
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

/** Strip internal multi-shot / ETA tags from the customer-facing prompt. */
export function cleanAssetPrompt(prompt: string | undefined | null): string {
  if (!prompt) return "";
  return prompt
    .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
    .replace(/\n\n\(جاري توليد ودمج[\s\S]*$/u, "")
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
