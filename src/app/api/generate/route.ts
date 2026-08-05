import { NextResponse } from "next/server";
import {
  GeminiConfigError,
  generateGeminiImage,
  isGeminiConfigured,
} from "@/lib/gemini-image";
import {
  generateGeminiVideo,
  isGeminiConfigured as isVideoConfigured,
} from "@/lib/gemini-video";
import { estimateCredits } from "@/lib/models";
import type { GenerateRequest, VideoDuration, VideoQuality } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const mode = body.mode;
    const prompt = body.prompt?.trim();
    const duration = (body.duration ?? 5) as VideoDuration;
    const quality = (body.quality ?? "standard") as VideoQuality;
    const waitForResult = body.waitForResult !== false;

    if (!mode || !prompt) {
      return NextResponse.json({ error: "mode and prompt are required" }, { status: 400 });
    }

    if (!isGeminiConfigured() || !isVideoConfigured()) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured on the server.",
          live: false,
          provider: "gemini",
        },
        { status: 401 },
      );
    }

    if (mode === "image-to-video" && !body.startFrame) {
      return NextResponse.json(
        { error: "Start frame image is required for Image-to-Video." },
        { status: 400 },
      );
    }

    if (!waitForResult) {
      return NextResponse.json(
        { error: "Generation requires waitForResult=true", provider: "gemini" },
        { status: 400 },
      );
    }

    const creditsUsed = estimateCredits(mode, duration, quality);

    if (mode === "text-to-image") {
      const result = await generateGeminiImage({
        prompt,
        referenceImage: body.referenceImage,
      });

      return NextResponse.json({
        historyId: result.imageId,
        status: "COMPLETED",
        mediaType: "image",
        mode,
        prompt,
        creditsUsed,
        url: result.url,
        playbackUrl: result.playbackUrl,
        provider: "gemini",
        tool: "gemini.models.generateContent",
        live: true,
      });
    }

    const result = await generateGeminiVideo({
      mode,
      prompt,
      duration,
      startFrame: body.startFrame,
      referenceImage: body.referenceImage,
    });

    return NextResponse.json({
      historyId: result.interactionId,
      status: result.status,
      mediaType: "video",
      mode,
      prompt,
      creditsUsed,
      url: result.url,
      playbackUrl: result.playbackUrl,
      provider: "gemini",
      tool: "gemini.interactions.create",
      live: true,
    });
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          live: false,
          provider: "gemini",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generation failed",
        live: true,
        provider: "gemini",
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { error },
      },
      { status: 500 },
    );
  }
}
