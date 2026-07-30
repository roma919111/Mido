import { NextResponse } from "next/server";
import { isBytePlusConfigured } from "@/lib/byteplus-ark";

export const runtime = "nodejs";

/** OpenArt owner setup is retired. */
export async function GET() {
  return NextResponse.json(
    {
      platformConnected: isBytePlusConfigured(),
      provider: "byteplus",
      openart: "disabled",
      message: "OpenArt setup is disabled. Configure BYTEPLUS_API_KEY instead.",
    },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: "OpenArt setup is disabled. Configure BYTEPLUS_API_KEY on the server.",
      provider: "byteplus",
    },
    { status: 410 },
  );
}
