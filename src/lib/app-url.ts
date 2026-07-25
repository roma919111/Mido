import { PREVIEW_ORIGIN } from "@/lib/site";

function isEphemeralTunnel(url: string): boolean {
  try {
    return /\.trycloudflare\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Public origin used for Google OAuth, Stripe redirects, and owner OAuth.
 * Prefer APP_BASE_URL. Ephemeral Cloudflare quick tunnels are rejected in favor
 * of the stable Vyronix preview host until a purchased domain is configured.
 */
export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "";

  if (fromEnv) {
    if (isEphemeralTunnel(fromEnv)) {
      return PREVIEW_ORIGIN;
    }
    return fromEnv.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return PREVIEW_ORIGIN;
  }

  return "http://localhost:3000";
}
