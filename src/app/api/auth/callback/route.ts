import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/auth-session";

export const runtime = "nodejs";

/** OpenArt OAuth callback retired. */
export async function GET(request: Request) {
  const dest = new URL("/setup", getAppBaseUrl(request));
  dest.searchParams.set(
    "authError",
    "OpenArt OAuth is disabled. Configure BYTEPLUS_API_KEY instead.",
  );
  return NextResponse.redirect(dest);
}
