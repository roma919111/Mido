import { loadLockedPublicOrigin } from "@/lib/public-base-url";

/** Permanent public origin for this deployment. */
export const CANONICAL_APP_ORIGIN = "https://vyronix.app";

function isEphemeralOrigin(origin: string): boolean {
  return /localhost|127\.0\.0\.1|trycloudflare\.com|\.loca\.lt/i.test(origin);
}

/**
 * Public origin for Google OAuth, Stripe, and owner OAuth.
 * Priority:
 * 1) Owner-locked origin in `.data/public-base-url.json`
 * 2) APP_BASE_URL / NEXT_PUBLIC_APP_BASE_URL (non-ephemeral preferred)
 * 3) Canonical https://vyronix.app
 */
export function getAppBaseUrl(): string {
  const locked = loadLockedPublicOrigin();
  if (locked) return locked;

  const fromEnv =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";

  if (fromEnv) {
    const normalized = fromEnv.replace(/\/$/, "");
    if (!isEphemeralOrigin(normalized)) return normalized;
  }

  return CANONICAL_APP_ORIGIN;
}
