import type { CustomerUser } from "@/components/veronix/AppHeader";

const KEY = "veronix_customer_snapshot";

export function readCustomerSnapshot(): CustomerUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerUser;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCustomerSnapshot(user: CustomerUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user?.id) {
      sessionStorage.setItem(KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}
