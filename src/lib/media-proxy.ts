/**
 * Same-origin media URLs so customers never see OpenArt CDN links
 * in the address bar, download sheet, or video player source.
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

function buildMediaApiPath(
  input: {
    historyId?: string | null;
    url?: string | null;
    mediaType?: "image" | "video";
  },
  mode: "download" | "stream",
): string | null {
  const mediaType = input.mediaType || "video";
  const ext = mediaType === "video" ? "mp4" : "png";
  const filename = `veronix-${Date.now()}.${ext}`;
  const endpoint =
    mode === "download" ? "/api/media/download" : "/api/media/stream";

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
    return mode === "stream" ? raw : null;
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
  return buildMediaApiPath(input, "stream") || input.url?.trim() || null;
}
