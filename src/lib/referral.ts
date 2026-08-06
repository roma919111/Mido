import { randomBytes } from "node:crypto";
import {
  adjustCredits,
  findUserById,
  findUserByReferralCode,
  updateUser,
  type UserRecord,
} from "@/lib/db";
import {
  buildReferralSignupUrl,
  normalizeReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral-shared";

export {
  buildReferralSignupUrl,
  normalizeReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral-shared";

export function referralSignupCreditsReferrer(): number {
  const n = Number(process.env.REFERRAL_SIGNUP_CREDITS_REFERRER ?? "500");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 500;
}

export function referralSignupCreditsReferee(): number {
  const n = Number(process.env.REFERRAL_SIGNUP_CREDITS_REFEREE ?? "200");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

export function generateReferralCode(): string {
  return randomBytes(4).toString("hex");
}

/** Assign a unique referral code if the user does not have one yet. */
export async function ensureUserReferralCode(userId: string): Promise<string> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.referralCode?.trim()) return user.referralCode.trim().toLowerCase();

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    const taken = await findUserByReferralCode(code);
    if (taken && taken.id !== userId) continue;
    await updateUser(userId, { referralCode: code });
    return code;
  }
  const fallback = userId.replace(/-/g, "").slice(0, 10);
  await updateUser(userId, { referralCode: fallback });
  return fallback;
}

/**
 * Credit referrer + referee once on first signup.
 * Safe to call multiple times — skips if already referred.
 */
export async function applyReferralOnSignup(
  newUserId: string,
  rawReferralCode: string | null | undefined,
): Promise<{ applied: boolean; referrerId?: string }> {
  const code = normalizeReferralCode(rawReferralCode);
  if (!code) return { applied: false };

  const newUser = await findUserById(newUserId);
  if (!newUser || newUser.referredByUserId) return { applied: false };

  const referrer = await findUserByReferralCode(code);
  if (!referrer || referrer.id === newUserId) return { applied: false };

  const refereeBonus = referralSignupCreditsReferee();
  const referrerBonus = referralSignupCreditsReferrer();

  await updateUser(newUserId, { referredByUserId: referrer.id });
  await adjustCredits(newUserId, refereeBonus);
  await adjustCredits(referrer.id, referrerBonus);

  return { applied: true, referrerId: referrer.id };
}

export function referralStats(user: UserRecord) {
  return {
    code: user.referralCode || "",
    referredByUserId: user.referredByUserId || null,
    signupUrl: user.referralCode
      ? buildReferralSignupUrl(user.referralCode)
      : null,
    referrerBonus: referralSignupCreditsReferrer(),
    refereeBonus: referralSignupCreditsReferee(),
  };
}
