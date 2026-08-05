import { NextResponse } from "next/server";
import { isGeminiConfigured } from "@/lib/gemini-client";

export const runtime = "nodejs";

export async function GET() {
  const configured = isGeminiConfigured();

  return NextResponse.json({
    configured,
    live: configured,
    provider: "gemini",
    credits: configured ? 9999 : 0,
    plan: configured ? "Gemini API" : "Not configured",
    email: "VYRONIX.AI Studio",
    error: configured ? undefined : "GEMINI_API_KEY is not configured on the server.",
  }, { status: configured ? 200 : 503 });
}
