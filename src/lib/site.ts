/**
 * Client-safe defaults only. Runtime Google/Stripe redirects come from
 * getAppBaseUrl() / /api/auth/google/status (owner-locked public URL).
 */
export const PREVIEW_HOST = "localhost:3000";
export const PREVIEW_ORIGIN = `http://${PREVIEW_HOST}`;
export const CANONICAL_HOST = PREVIEW_HOST;
export const CANONICAL_ORIGIN = PREVIEW_ORIGIN;
/** Placeholder until /api/auth/google/status returns the locked URI */
export const GOOGLE_REDIRECT_URI = `${PREVIEW_ORIGIN}/api/auth/google/callback`;

export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() || "";
  return h === PREVIEW_HOST.split(":")[0];
}
