import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Legacy OpenArt creations list — retired. Use /api/assets. */
export async function GET() {
  return NextResponse.json(
    {
      configured: false,
      live: false,
      provider: "byteplus",
      items: [],
      error: "OpenArt creations list is disabled. Use /api/assets.",
    },
    { status: 410 },
  );
}
