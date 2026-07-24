import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { repository } from "@/lib/db/repository";
import { buildGenerationParams, estimateAppCredits, qualityToResolution } from "@/lib/models";
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

    if (waitResult.isError) return { status: "FAILED", payload: lastPayload };

    const status = String(
      lastPayload.status ?? lastPayload.state ?? lastPayload.resultStatus ?? "",
    ).toUpperCase();

    if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) {
      return { status, payload: lastPayload };
    }

    const urls = collectMediaUrls(lastPayload);
    if (urls.length > 0) return { status: "COMPLETED", payload: lastPayload };
  }

  return { status: "STILL_RUNNING", payload: lastPayload };
}

export async function POST(request: Request) {
  let charged = 0;
  let userId: string | null = null;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to generate" }, { status: 401 });
    }
    userId = user.id;

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
    if (mode === "inpaint" && !body.referenceImage && !body.startFrame) {
      return NextResponse.json(
        { error: "Upload a reference image for Inpaint / Edit" },
        { status: 400 },
      );
    }

    const creditsUsed = estimateAppCredits(mode);
    if (user.credits < creditsUsed) {
      return NextResponse.json(
        { error: `Not enough credits. This generation costs ${creditsUsed} credits.` },
        { status: 402 },
      );
    }

    const balance = await repository.deductCredits(user.id, creditsUsed, "generation", {
      mode,
      prompt,
    });
    charged = creditsUsed;

    const draft = await repository.createGeneration({
      userId: user.id,
      mode,
      mediaType: mode.includes("video") ? "video" : "image",
      prompt,
      negativePrompt: body.negativePrompt ?? null,
      stylePreset: body.stylePreset ?? null,
      aspectRatio: body.aspectRatio ?? null,
      duration: mode.includes("video") ? duration : null,
      resolution: mode.includes("video") ? qualityToResolution(quality) : null,
      settings: {
        quality,
        startFrame: body.startFrame ?? null,
        referenceImage: body.referenceImage ?? null,
      },
      status: "running",
      creditsUsed,
      isPublic: Boolean(body.isPublic),
    });

    if (!isOpenArtConfigured()) {
      const isVideo = mode.includes("video");
      const urls = [
        isVideo
          ? "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
          : "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1200&q=80",
      ];

      const completed = await repository.updateGeneration(draft.id, {
        status: "completed",
        mediaUrl: urls[0],
        thumbnailUrl: isVideo
          ? "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80"
          : urls[0],
        historyId: `demo_${Date.now()}`,
      });

      return NextResponse.json({
        generation: completed,
        creditsUsed,
        balance,
        demo: true,
        message:
          "Demo generation saved to your private library. Set OPENART_ACCESS_TOKEN for live OpenArt MCP output.",
      });
    }

    const { model, toolMode, media, params } = buildGenerationParams({
      mode,
      prompt,
      negativePrompt: body.negativePrompt,
      stylePreset: body.stylePreset,
      aspectRatio: body.aspectRatio,
      duration,
      quality,
      startFrame: body.startFrame,
      referenceImage: body.referenceImage,
    });

    const toolName = media === "image" ? "openart_generate_image" : "openart_generate_video";
    const generateResult = await callOpenArtTool(toolName, {
      model,
      mode: toolMode,
      params,
    });
    const generatePayload = parseToolPayload(generateResult);

    if (generateResult.isError) {
      await repository.refundCredits(user.id, creditsUsed, "generation_refund");
      charged = 0;
      await repository.updateGeneration(draft.id, {
        status: "failed",
        error: String(generatePayload.rawText ?? "OpenArt generation failed"),
      });
      return NextResponse.json(
        { error: generatePayload.rawText ?? "OpenArt generation failed" },
        { status: 502 },
      );
    }

    const historyId = getHistoryId(generatePayload);
    if (!historyId) {
      await repository.refundCredits(user.id, creditsUsed, "generation_refund");
      charged = 0;
      await repository.updateGeneration(draft.id, {
        status: "failed",
        error: "No historyId returned",
      });
      return NextResponse.json({ error: "No historyId returned from OpenArt" }, { status: 502 });
    }

    await repository.updateGeneration(draft.id, { historyId, status: "running" });

    if (!waitForResult) {
      return NextResponse.json({
        generation: { ...draft, historyId, status: "running" },
        creditsUsed,
        balance,
      });
    }

    const waited = await waitForCreation(historyId);
    const urls = collectMediaUrls(waited.payload);

    if (waited.status === "FAILED") {
      await repository.refundCredits(user.id, creditsUsed, "generation_refund");
      charged = 0;
      const failed = await repository.updateGeneration(draft.id, {
        status: "failed",
        historyId,
        error: String(waited.payload.error ?? waited.payload.message ?? "Generation failed"),
      });
      return NextResponse.json({ generation: failed, error: failed.error }, { status: 502 });
    }

    const completed = await repository.updateGeneration(draft.id, {
      status: waited.status === "COMPLETED" || urls[0] ? "completed" : "running",
      historyId,
      mediaUrl: urls[0] ?? null,
      thumbnailUrl: urls.find((u) => !/\.mp4|\.webm/i.test(u)) ?? urls[0] ?? null,
    });

    return NextResponse.json({
      generation: completed,
      creditsUsed,
      balance,
      urls,
    });
  } catch (error) {
    if (charged > 0 && userId) {
      try {
        await repository.refundCredits(userId, charged, "generation_refund");
      } catch {
        // ignore refund failure
      }
    }

    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
