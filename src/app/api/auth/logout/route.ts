import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/auth-session";
import { clearOwnerAuthSession, isOwnerSetupAuthorized } from "@/lib/owner-credentials";

export const runtime = "nodejs";

/** OWNER-ONLY — clears server-side platform OpenArt credentials. */
export async function POST(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearOwnerAuthSession();
  return NextResponse.json({ ok: true, clearedOwnerCredentials: true });
}

export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearOwnerAuthSession();
  return NextResponse.redirect(new URL("/", getAppBaseUrl(request)));
}
