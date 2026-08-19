import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleUser,
  isGoogleOAuthConfigured,
  parseOAuthState,
  resolvePublicOrigin,
} from "@/lib/google-oauth";
import { setDriveAccessToken } from "@/lib/google-drive-token";
import { attachSessionCookie, clearSessionCookie } from "@/lib/customer-auth";
import { findUserByEmail, findUserByGoogleId, upsertGoogleUser } from "@/lib/db";
import { applyReferralOnSignup } from "@/lib/referral";
import { readReferralCookie } from "@/lib/referral-cookie";
import { reconcileCustomerWallet } from "@/lib/wallet-reconcile";
import { postAuthDestination, safeAuthNextPath } from "@/lib/auth-next";
import { isAdminEmail } from "@/lib/admin-shared";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base = resolvePublicOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const { next: rawNext, ref: refFromState, intent } = parseOAuthState(state);
  const next = safeAuthNextPath(rawNext);

  if (!(await isGoogleOAuthConfigured())) {
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent("Google غير جاهز — سجّل بالبريد")}`,
    );
  }

  if (oauthError) {
    const dest =
      intent === "drive"
        ? `/assets?storage=1&error=${encodeURIComponent(oauthError)}`
        : `/signup?error=${encodeURIComponent(
            oauthError === "redirect_uri_mismatch"
              ? "إعداد Google ناقص (redirect_uri). سجّل بالبريد الآن أو حدّث Redirect URI."
              : oauthError,
          )}&next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(`${base}${dest}`);
  }

  if (!code) {
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent("Missing Google auth code")}`,
    );
  }

  try {
    const tokens = await exchangeGoogleCode(code, request);

    if (intent === "drive") {
      await setDriveAccessToken(tokens.access_token);
      const dest = safeAuthNextPath(next, "/assets?storage=drive");
      const sep = dest.includes("?") ? "&" : "?";
      return NextResponse.redirect(`${base}${dest}${sep}drive=ready`);
    }

    const profile = await fetchGoogleUser(tokens.access_token);
    const existing =
      (await findUserByGoogleId(profile.googleId)) ||
      (await findUserByEmail(profile.email));
    const user = await upsertGoogleUser(profile);
    if (!existing) {
      const cookieRef = await readReferralCookie();
      await applyReferralOnSignup(user.id, refFromState || cookieRef);
    }
    if (user.locked && !isAdminEmail(user.email)) {
      await clearSessionCookie();
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent(
          user.lockedReason?.trim() || "تم إيقاف هذا الحساب. تواصل مع الدعم.",
        )}`,
      );
    }
    await reconcileCustomerWallet(user);
    const dest = postAuthDestination(next, user.email);
    const path = !existing
      ? `${dest}${dest.includes("?") ? "&" : "?"}ga_signup=1`
      : dest;
    const res = NextResponse.redirect(`${base}${path}`);
    return attachSessionCookie(res, user.id, user.email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed";
    const friendly = /redirect_uri/i.test(message)
      ? "إعداد Google ناقص (redirect_uri). سجّل بالبريد الآن."
      : message;
    if (intent === "drive") {
      return NextResponse.redirect(
        `${base}/assets?storage=1&error=${encodeURIComponent(friendly)}`,
      );
    }
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent(friendly)}&next=${encodeURIComponent(next)}`,
    );
  }
}
