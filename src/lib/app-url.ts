import { loadLockedPublicOrigin } from "@/lib/public-base-url";

/**
 * Public origin for Google OAuth, Stripe, and owner OAuth.
 * Priority:
 * 1) Owner-locked origin in `.data/public-base-url.json` (never auto-drifts)
 * 2) APP_BASE_URL env (unless ephemeral trycloudflare without a lock)
 * 3) localhost
 */
export function getAppBaseUrl(): string {
  const locked = loadLockedPublicOrigin();
  if (locked) return locked;

  const fromEnv =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "";

  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
