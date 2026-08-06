/** Client-safe referral helpers (no Node.js / DB imports). */

export const REFERRAL_COOKIE = "veronix_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function normalizeReferralCode(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export function buildReferralSignupUrl(code: string, base = "https://vyronix.app"): string {
  const normalized = normalizeReferralCode(code);
  return `${base.replace(/\/$/, "")}/signup?ref=${encodeURIComponent(normalized)}`;
}

/** Client-side helper — persist ref from landing URL. */
export function persistReferralCodeClient(code: string): void {
  if (typeof document === "undefined") return;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  const maxAge = REFERRAL_COOKIE_MAX_AGE;
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(normalized)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function readReferralCodeClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return normalizeReferralCode(decodeURIComponent(match[1]));
  } catch {
    return normalizeReferralCode(match[1]);
  }
}
