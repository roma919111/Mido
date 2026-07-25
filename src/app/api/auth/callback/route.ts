import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/auth-session";
import { completeOwnerOpenArtConnect } from "@/lib/openart-oauth";

export const runtime = "nodejs";

/** OWNER-ONLY OAuth callback — stores platform credentials server-side. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const dest = new URL("/setup/openart", getAppBaseUrl(request));

  if (oauthError) {
    dest.searchParams.set(
      "error",
      errorDescription || oauthError || "OpenArt authorization was denied",
    );
    return NextResponse.redirect(dest);
  }

  if (!code) {
    dest.searchParams.set("error", "Missing authorization code from OpenArt");
    return NextResponse.redirect(dest);
  }

  try {
    await completeOwnerOpenArtConnect(request, code, state);
    dest.searchParams.set("connected", "1");
    return NextResponse.redirect(dest);
  } catch (error) {
    dest.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Owner OpenArt OAuth callback failed",
    );
    return NextResponse.redirect(dest);
  }
}
