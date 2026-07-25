/**
 * Preview / staging public host used until a real purchased domain is attached.
 * Keep this stable (same subdomain) so Google OAuth redirect does not drift.
 */
export const PREVIEW_HOST = "vyronix-ai.loca.lt";
export const PREVIEW_ORIGIN = `https://${PREVIEW_HOST}`;

/** @deprecated use getAppBaseUrl() — kept for UI copy defaults */
export const CANONICAL_HOST = PREVIEW_HOST;
export const CANONICAL_ORIGIN = PREVIEW_ORIGIN;
export const GOOGLE_REDIRECT_URI = `${PREVIEW_ORIGIN}/api/auth/google/callback`;

export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() || "";
  return h === PREVIEW_HOST || h === CANONICAL_HOST;
}
