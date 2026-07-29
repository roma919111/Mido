import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getGoogleRedirectUri, isGoogleOAuthConfigured } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configured = await isGoogleOAuthConfigured();
  return NextResponse.json({
    configured,
    appBaseUrl: getAppBaseUrl(),
    redirectUri: getGoogleRedirectUri(request),
  });
}
