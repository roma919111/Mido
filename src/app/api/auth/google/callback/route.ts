import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleUser,
  isGoogleOAuthConfigured,
  parseOAuthState,
  resolvePublicOrigin,
} from "@/lib/google-oauth";
import { setSessionCookie, clearSessionCookie } from "@/lib/customer-auth";
import { upsertGoogleUser } from "@/lib/db";
import { reconcileCustomerWallet } from "@/lib/wallet-reconcile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base = resolvePublicOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const { next } = parseOAuthState(state);

  if (!(await isGoogleOAuthConfigured())) {
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent("Google غير جاهز — سجّل بالبريد")}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent(
        oauthError === "redirect_uri_mismatch"
          ? "إعداد Google ناقص (redirect_uri). سجّل بالبريد الآن أو حدّث Redirect URI."
          : oauthError,
      )}&next=${encodeURIComponent(next)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent("Missing Google auth code")}`,
    );
  }

  try {
    const tokens = await exchangeGoogleCode(code, request);
    const profile = await fetchGoogleUser(tokens.access_token);
    const user = await upsertGoogleUser(profile);
    if (user.locked) {
      await clearSessionCookie();
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent(
          user.lockedReason?.trim() || "تم إيقاف هذا الحساب. تواصل مع الدعم.",
        )}`,
      );
    }
    await setSessionCookie(user.id);
    // Restore paid wallet from Stripe if local DB was rebuilt.
    await reconcileCustomerWallet(user);
    return NextResponse.redirect(`${base}${next.startsWith("/") ? next : "/"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed";
    const friendly = /redirect_uri/i.test(message)
      ? "إعداد Google ناقص (redirect_uri). سجّل بالبريد الآن."
      : message;
    return NextResponse.redirect(
      `${base}/signup?error=${encodeURIComponent(friendly)}&next=${encodeURIComponent(next)}`,
    );
  }
}
