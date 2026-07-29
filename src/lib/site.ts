/**
 * Client-safe defaults. Runtime redirects come from getAppBaseUrl().
 */
export const PREVIEW_HOST = "vyronix.app";
export const PREVIEW_ORIGIN = `https://${PREVIEW_HOST}`;
export const CANONICAL_HOST = PREVIEW_HOST;
export const CANONICAL_ORIGIN = PREVIEW_ORIGIN;
export const GOOGLE_REDIRECT_URI = `${PREVIEW_ORIGIN}/api/auth/google/callback`;

export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() || "";
  return h === PREVIEW_HOST || h === `www.${PREVIEW_HOST}`;
}
