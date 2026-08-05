import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { error: "Owner OAuth callback is disabled. Use GEMINI_API_KEY instead." },
    { status: 410 },
  );
}
