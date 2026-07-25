import { NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set(
      "error",
      "Google Sign-In is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
    return NextResponse.redirect(url);
  }

  const incoming = new URL(request.url);
  const next = incoming.searchParams.get("next") || "/";
  const paywall = incoming.searchParams.get("paywall");
  const nextPath =
    paywall === "1"
      ? `/pricing?paywall=1`
      : next.startsWith("/")
        ? next
        : "/";

  const state = createOAuthState(nextPath);
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
