import { NextResponse } from "next/server";
import { calculateImageCredits, calculateVideoCredits } from "@/lib/credit-pricing";
import { resolveVideoResolution, VIDEO_MODEL } from "@/lib/models";
import type { GenerateRequest, VideoDuration } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Pick<
      GenerateRequest,
      "mode" | "duration" | "resolution" | "quality" | "generateAudio"
    >;

    const mode = body.mode;
    if (!mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }

    if (mode === "text-to-image") {
      const credits = calculateImageCredits();
      return NextResponse.json({
        model: "nano-banana-2-lite",
        media: "image",
        totalCredits: credits,
        creditsPerSecond: null,
        durationInSeconds: null,
      });
    }

    const duration = (body.duration ?? 5) as VideoDuration;
    const resolution = resolveVideoResolution(body);
    const hasAudio = Boolean(body.generateAudio);

    const totalCredits = calculateVideoCredits({
      model: VIDEO_MODEL,
      resolution,
      hasAudio,
      durationInSeconds: duration,
    });

    return NextResponse.json({
      model: VIDEO_MODEL,
      media: "video",
      resolution,
      hasAudio,
      durationInSeconds: duration,
      totalCredits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quote failed" },
      { status: 400 },
    );
  }
}
