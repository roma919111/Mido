import { cookies } from "next/headers";
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  normalizeReferralCode,
} from "@/lib/referral-shared";

export async function readReferralCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(REFERRAL_COOKIE)?.value;
  const code = normalizeReferralCode(raw);
  return code || null;
}

export async function setReferralCookie(code: string): Promise<void> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  const jar = await cookies();
  const httpsPublic =
    (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || "").startsWith(
      "https://",
    );
  jar.set(REFERRAL_COOKIE, normalized, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || httpsPublic,
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE,
  });
}

export {
  persistReferralCodeClient,
  readReferralCodeClient,
} from "@/lib/referral-shared";
