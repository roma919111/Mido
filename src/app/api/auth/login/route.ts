import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/auth-session";
import { beginOpenArtOAuthLogin } from "@/lib/openart-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const authorizationUrl = await beginOpenArtOAuthLogin(request);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenArt OAuth login failed";
    const dest = new URL("/", getAppBaseUrl(request));
    dest.searchParams.set("authError", message);
    return NextResponse.redirect(dest);
  }
}
