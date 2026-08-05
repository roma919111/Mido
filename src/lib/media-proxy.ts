const ALLOWED_HOST_SUFFIXES = [
  ".openart.ai",
  ".openart.com",
  ".pixverse.ai",
  ".bytepluses.com",
  ".byteplus.com",
  ".volces.com",
  ".amazonaws.com",
  ".cloudfront.net",
  ".googleusercontent.com",
];

export function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "openart.ai" ||
    host === "openart.com" ||
    host === "pixverse.ai" ||
    host === "byteplus.com" ||
    host === "bytepluses.com"
  ) {
    return true;
  }
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function toMediaProxyUrl(
  url: string,
  mediaType: "image" | "video" = "video",
): string | null {
  const raw = url.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!isAllowedMediaHost(parsed.hostname)) return null;
    const qs = new URLSearchParams({
      u: toBase64Url(parsed.toString()),
      type: mediaType,
    });
    return `/api/media/proxy?${qs.toString()}`;
  } catch {
    return null;
  }
}

export function decodeMediaProxyParam(encoded: string): string | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = new URL(decoded);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!isAllowedMediaHost(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Prefer same-origin proxy for video playback (CORS + correct Content-Type). */
export function toPlaybackUrl(
  url: string,
  mediaType: "image" | "video",
): string {
  if (!url) return "";
  if (mediaType === "image") return url;
  return toMediaProxyUrl(url, mediaType) ?? url;
}
