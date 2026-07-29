import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** OpenArt OAuth login retired — generation uses BytePlus only. */
export async function GET() {
  return NextResponse.json(
    {
      error: "OpenArt owner OAuth is disabled. Set BYTEPLUS_API_KEY on the server.",
      provider: "byteplus",
    },
    { status: 410 },
  );
}
