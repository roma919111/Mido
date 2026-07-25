import { NextResponse } from "next/server";
import { clearAuthSession, getAppBaseUrl } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST() {
  await clearAuthSession();
  return NextResponse.json({ ok: true, loggedOut: true });
}

export async function GET(request: Request) {
  await clearAuthSession();
  return NextResponse.redirect(new URL("/", getAppBaseUrl(request)));
}
