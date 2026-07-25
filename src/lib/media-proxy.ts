/**
 * Build same-origin download URLs so customers never see OpenArt CDN links.
 */

const ALLOWED_HOST_SUFFIXES = [".openart.ai", ".openart.com"];

export function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "openart.ai" || host === "openart.com") return true;
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

export function veronixDownloadPath(input: {
  historyId?: string | null;
  url?: string | null;
  mediaType?: "image" | "video";
}): string | null {
  const mediaType = input.mediaType || "video";
  const ext = mediaType === "video" ? "mp4" : "png";
  const filename = `veronix-${Date.now()}.${ext}`;

  if (input.historyId?.trim()) {
    const qs = new URLSearchParams({
      historyId: input.historyId.trim(),
      type: mediaType,
      filename,
    });
    return `/api/media/download?${qs.toString()}`;
  }

  const raw = input.url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!isAllowedMediaHost(parsed.hostname)) return null;
  } catch {
    return null;
  }

  const qs = new URLSearchParams({
    u: toBase64Url(raw),
    type: mediaType,
    filename,
  });
  return `/api/media/download?${qs.toString()}`;
}
