import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { buildVeronixShotScriptAsync } from "@/lib/veronix-shot-script";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  prompt?: string;
  enhancedPrompt?: string;
  minSeconds?: number;
  maxSeconds?: number;
};

/**
 * AI shot script: action → subject(name) → object(name), no verb repeats.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Login required", needsAuth: true },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Body;
    const prompt = body.prompt?.trim() || "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const script = await buildVeronixShotScriptAsync({
      originalPrompt: prompt,
      enhancedPrompt: body.enhancedPrompt?.trim() || undefined,
      minSeconds: body.minSeconds,
      maxSeconds: body.maxSeconds,
    });

    return NextResponse.json({
      script,
      summaryAr: script.summaryAr,
      totalSeconds: script.totalSeconds,
      scriptPrompt: script.scriptPrompt,
      beats: script.beats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to build shot script",
      },
      { status: 500 },
    );
  }
}
