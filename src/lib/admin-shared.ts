/** Client-safe admin identity helpers (no node imports). */

export const ADMIN_EMAIL = "ees1986@hotmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminUser(user: { email?: string | null } | null | undefined): boolean {
  return Boolean(user && isAdminEmail(user.email));
}
