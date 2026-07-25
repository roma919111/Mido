import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleUser,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured,
  parseOAuthState,
} from "@/lib/google-oauth";
import { setSessionCookie } from "@/lib/customer-auth";
import { upsertGoogleUser } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/app-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base = getAppBaseUrl().replace(/\/$/, "");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const { next } = parseOAuthState(state);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent("Google Sign-In is not configured")}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(oauthError)}&next=${encodeURIComponent(next)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent("Missing Google auth code")}`,
    );
  }

  try {
    // Ensure redirect_uri used in exchange matches authorize step
    void getGoogleRedirectUri();
    const tokens = await exchangeGoogleCode(code);
    const profile = await fetchGoogleUser(tokens.access_token);
    const user = await upsertGoogleUser(profile);
    await setSessionCookie(user.id);
    return NextResponse.redirect(`${base}${next.startsWith("/") ? next : "/"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed";
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`,
    );
  }
}
