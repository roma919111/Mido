import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      error: "Owner OAuth is disabled. Configure GEMINI_API_KEY in environment variables.",
      provider: "gemini",
    },
    { status: 410 },
  );
}
