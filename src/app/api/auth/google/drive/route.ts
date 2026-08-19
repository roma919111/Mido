import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

/** Start Google Drive OAuth (drive.file) for backing up customer videos. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
  }
  if (!(await isGoogleOAuthConfigured())) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/assets?storage=drive";
  const state = createOAuthState(next.startsWith("/") ? next : "/assets?storage=drive", null, "drive");
  const authUrl = await buildGoogleAuthUrl(state, request, { drive: true });
  return NextResponse.redirect(authUrl);
}
