import { NextResponse } from "next/server";
import { isGeminiConfigured } from "@/lib/gemini-client";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: isGeminiConfigured(),
    provider: "gemini",
    authMethod: isGeminiConfigured() ? "env" : null,
  });
}
