/** Canonical public site — fixed brand domain (not ephemeral tunnels). */
export const CANONICAL_HOST = "veronix.ai";
export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
export const GOOGLE_REDIRECT_URI = `${CANONICAL_ORIGIN}/api/auth/google/callback`;

export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() || "";
  return h === CANONICAL_HOST || h === `www.${CANONICAL_HOST}`;
}
