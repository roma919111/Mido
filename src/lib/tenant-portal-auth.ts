import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { VoiceTenantRecord } from "@/lib/voice-tenant-types";

const COOKIE_NAME = "vyronix_tenant_portal";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    process.env.TENANT_PORTAL_SECRET?.trim() ||
    "veronix-dev-tenant-portal-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function issueTenantPortalCookie(tenantId: string): Promise<void> {
  const token = await new SignJWT({ tid: tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearTenantPortalCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getTenantIdFromPortalCookie(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const tid = payload.tid;
    return typeof tid === "string" ? tid : null;
  } catch {
    return null;
  }
}

export function verifyPortalAccessToken(
  tenant: VoiceTenantRecord,
  token: string | null | undefined,
): boolean {
  if (tenant.status !== "active") return false;
  const expected = tenant.portalAccessToken?.trim();
  if (!expected) return false;
  return token?.trim() === expected;
}
