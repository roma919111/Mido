import { CANONICAL_ORIGIN } from "@/lib/site";

function isEphemeralTunnel(url: string): boolean {
  try {
    return /\.trycloudflare\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Public origin used for Google OAuth, Stripe redirects, and owner OAuth.
 * Prefer APP_BASE_URL; fall back to the locked brand domain (never a random tunnel).
 */
export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "";

  if (fromEnv) {
    // Reject ephemeral Cloudflare quick-tunnel hosts so OAuth stays stable.
    if (isEphemeralTunnel(fromEnv)) {
      return CANONICAL_ORIGIN;
    }
    return fromEnv.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_ORIGIN;
  }

  return "http://localhost:3000";
}
