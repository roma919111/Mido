/**
 * Owner admin console — gated to a single operator email (server-side).
 */

import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  getCurrentUser,
  getSessionEmail,
} from "@/lib/customer-auth";
import type { UserRecord } from "@/lib/db";
import { ADMIN_EMAIL, isAdminEmail, isAdminUser } from "@/lib/admin-shared";
import { isPlayerSurface } from "@/lib/vyronix-surface";

export { ADMIN_EMAIL, isAdminEmail, isAdminUser };

function denyAdmin(message = "Admin access denied"): never {
  const err = new Error(message);
  (err as Error & { status: number }).status = 403;
  throw err;
}

function adminStub(email: string, id = "admin"): UserRecord {
  const now = new Date().toISOString();
  return {
    id,
    email,
    name: "Admin",
    passwordHash: "",
    credits: 0,
    planId: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function adminFromStudioOrigin(): Promise<UserRecord | null> {
  const origin = process.env.STUDIO_ORIGIN?.trim().replace(/\/$/, "");
  if (!origin || !isPlayerSurface()) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${origin}/api/auth/customer/me`, {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      locked?: boolean;
      user?: { id?: string; email?: string };
    };
    if (!data.authenticated || data.locked || !isAdminEmail(data.user?.email)) return null;
    return adminStub(data.user!.email!.trim().toLowerCase(), data.user?.id || "admin");
  } catch {
    return null;
  }
}

/** Session must be the owner account. Locked owner can still open the console. */
export async function requireAdminUser(): Promise<UserRecord> {
  const sessionEmail = await getSessionEmail();
  const user = await getCurrentUser();

  if (sessionEmail && isAdminEmail(sessionEmail)) {
    if (user && isAdminEmail(user.email)) return user;
    return adminStub(sessionEmail, user?.id);
  }

  if (user && isAdminEmail(user.email)) return user;

  const remote = await adminFromStudioOrigin();
  if (remote) return remote;

  denyAdmin();
}

export function isUserLocked(user: Pick<UserRecord, "locked"> | null | undefined): boolean {
  return Boolean(user?.locked);
}
