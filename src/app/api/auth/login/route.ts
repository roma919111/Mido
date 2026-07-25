import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/auth-session";
import { beginOwnerOpenArtConnect } from "@/lib/openart-oauth";
import { isOwnerSetupAuthorized } from "@/lib/owner-credentials";

export const runtime = "nodejs";

/**
 * OWNER-ONLY setup. Customers never use this.
 * Visit /api/auth/login (optionally ?key=OWNER_SETUP_KEY) once to bind
 * the platform OpenArt account used for all customer generations.
 */
export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized owner setup. Provide OWNER_SETUP_KEY." },
      { status: 401 },
    );
  }

  try {
    const authorizationUrl = await beginOwnerOpenArtConnect(request);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Owner OpenArt connect failed";
    const dest = new URL("/", getAppBaseUrl(request));
    dest.searchParams.set("authError", message);
    return NextResponse.redirect(dest);
  }
}
