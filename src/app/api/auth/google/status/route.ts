import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { isGoogleOAuthConfigured, getGoogleRedirectUri } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET() {
  const configured = await isGoogleOAuthConfigured();
  return NextResponse.json({
    configured,
    appBaseUrl: getAppBaseUrl(),
    redirectUri: getGoogleRedirectUri(),
  });
}
