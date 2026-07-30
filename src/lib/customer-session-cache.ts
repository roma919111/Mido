/**
 * Persist the last known customer session so AppHeader / pages do not flash
 * Login while `/api/auth/customer/me` is in flight on soft navigations.
 */

import type { CustomerUser } from "@/components/veronix/AppHeader";

const CACHE_KEY = "veronix.customer.session.v1";

function isUser(v: unknown): v is CustomerUser {
  if (!v || typeof v !== "object") return false;
  const u = v as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    typeof u.email === "string" &&
    typeof u.credits === "number"
  );
}

export function readCachedCustomer(): CustomerUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedCustomer(user: CustomerUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      sessionStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    const payload = JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name || "",
      credits: user.credits,
      planId: user.planId ?? null,
      freeVeronixUsed: Boolean(user.freeVeronixUsed),
      locked: Boolean(user.locked),
    });
    sessionStorage.setItem(CACHE_KEY, payload);
    localStorage.setItem(CACHE_KEY, payload);
  } catch {
    // ignore quota / private mode
  }
}
