import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: isGoogleOAuthConfigured() });
}
