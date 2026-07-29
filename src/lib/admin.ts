/**
 * Owner admin console — gated to a single operator email (server-side).
 */

import { getCurrentUser } from "@/lib/customer-auth";
import type { UserRecord } from "@/lib/db";
import { ADMIN_EMAIL, isAdminEmail, isAdminUser } from "@/lib/admin-shared";

export { ADMIN_EMAIL, isAdminEmail, isAdminUser };

/** Session must be the owner account. */
export async function requireAdminUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    const err = new Error("Admin access denied");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  if (user.locked) {
    const err = new Error("Admin account is locked");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export function isUserLocked(user: Pick<UserRecord, "locked"> | null | undefined): boolean {
  return Boolean(user?.locked);
}
