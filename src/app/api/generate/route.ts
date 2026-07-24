import { NextResponse } from "next/server";
import { buildGenerationParams, estimateCredits } from "@/lib/models";
import {
  callOpenArtTool,
  collectMediaUrls,
  getHistoryId,
  isOpenArtConfigured,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { GenerateRequest, VideoDuration, VideoQuality } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

async function waitForCreation(historyId: string, attempts = 4) {
  let lastPayload: Record<string, unknown> = {};

  for (let i = 0; i < attempts; i += 1) {
    const waitResult = await callOpenArtTool("openart_creation_wait", {
      historyId,
      timeoutSeconds: 45,
    });

    lastPayload = parseToolPayload(waitResult);

    if (waitResult.isError) {
      return { status: "FAILED", payload: lastPayload };
    }

    const status = String(
      lastPayload.status ?? lastPayload.state ?? lastPayload.resultStatus ?? "",
    ).toUpperCase();

    if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) {
      return { status, payload: lastPayload };
    }

    if (status === "STILL_RUNNING" || status === "PENDING" || status === "RUNNING") {
      continue;
    }

    // Some payloads omit status but include media URLs when done.
    const urls = collectMediaUrls(lastPayload);
    if (urls.length > 0) {
      return { status: "COMPLETED", payload: lastPayload };
    }
  }

  return { status: "STILL_RUNNING", payload: lastPayload };
}

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

    if (mode === "image-to-video" && !body.startFrame) {
      return NextResponse.json(
        { error: "Start frame image is required for Image-to-Video" },
        { status: 400 },
      );
    }

    const creditsUsed = estimateCredits(mode, duration, quality);

    if (!isOpenArtConfigured()) {
      // Demo path so the UI remains usable without credentials.
      const historyId = `demo_${Date.now()}`;
      const isVideo = mode !== "text-to-image";
      return NextResponse.json({
        historyId,
        status: "COMPLETED",
        mediaType: isVideo ? "video" : "image",
        mode,
        prompt,
        creditsUsed,
        demo: true,
        urls: [
          isVideo
            ? "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
            : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
        ],
        message:
          "Demo generation returned sample media. Set OPENART_ACCESS_TOKEN to generate with OpenArt MCP.",
      });
    }

    const { model, toolMode, media, params } = buildGenerationParams({
      mode,
      prompt,
      duration,
      quality,
      startFrame: body.startFrame,
      referenceImage: body.referenceImage,
    });

    const toolName =
      media === "image" ? "openart_generate_image" : "openart_generate_video";

    const generateResult = await callOpenArtTool(toolName, {
      model,
      mode: toolMode,
      params,
    });

    const generatePayload = parseToolPayload(generateResult);
    if (generateResult.isError) {
      return NextResponse.json(
        {
          error: generatePayload.rawText ?? "OpenArt generation failed",
          details: generatePayload,
        },
        { status: 502 },
      );
    }

    const historyId = getHistoryId(generatePayload);
    if (!historyId) {
      return NextResponse.json(
        {
          error: "Generation started but no historyId was returned",
          details: generatePayload,
        },
        { status: 502 },
      );
    }

    if (!waitForResult) {
      return NextResponse.json({
        historyId,
        status: String(generatePayload.status ?? "PENDING"),
        mediaType: media,
        mode,
        prompt,
        creditsUsed,
        pollAfterSeconds:
          typeof generatePayload.pollAfterSeconds === "number"
            ? generatePayload.pollAfterSeconds
            : 3,
      });
    }

    const waited = await waitForCreation(historyId);
    const urls = collectMediaUrls(waited.payload);

    return NextResponse.json({
      historyId,
      status: waited.status,
      mediaType: media,
      mode,
      prompt,
      creditsUsed,
      urls,
      error:
        waited.status === "FAILED"
          ? String(waited.payload.error ?? waited.payload.message ?? "Generation failed")
          : undefined,
      payload: waited.payload,
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
