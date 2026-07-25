import { NextResponse } from "next/server";
import { getGoogleRedirectUri } from "@/lib/google-oauth";
import { resolvePublicOrigin } from "@/lib/google-oauth";

export const runtime = "nodejs";

/**
 * Google customer login is temporarily blocked.
 * Reason: Google Cloud Console is missing the current tunnel redirect URI
 * (Error 400: redirect_uri_mismatch). Email signup works for every customer.
 */
export async function GET(request: Request) {
  const base = resolvePublicOrigin(request);
  const redirectUri = getGoogleRedirectUri(request);
  const dest = new URL("/signup", base);
  dest.searchParams.set(
    "error",
    `Google متوقف مؤقتًا. سجّل بالبريد الآن. (يلزم إضافة Redirect URI في Google Cloud: ${redirectUri})`,
  );
  return NextResponse.redirect(dest);
}
