import { NextResponse } from "next/server";
import { buildGenerationParams, estimateCredits } from "@/lib/models";
import {
  callOpenArtTool,
  collectMediaUrls,
  getHistoryId,
  OpenArtConfigError,
  parseToolPayload,
  pickPrimaryMediaUrl,
  pickThumbnailUrl,
} from "@/lib/openart-mcp";
import type { GenerateRequest, VideoDuration, VideoQuality } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

async function waitForCreation(
  historyId: string,
  media: "image" | "video",
  attempts = 6,
) {
  let lastPayload: Record<string, unknown> = {};
  let lastRaw: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    const waitResult = await callOpenArtTool("openart_creation_wait", {
      historyId,
      timeoutSeconds: 45,
    });

    lastRaw = waitResult;
    lastPayload = parseToolPayload(waitResult);

    if (waitResult.isError) {
      return { status: "FAILED", payload: lastPayload, raw: lastRaw };
    }

    const status = String(
      lastPayload.status ?? lastPayload.state ?? lastPayload.resultStatus ?? "",
    ).toUpperCase();

    const urls = collectMediaUrls(lastPayload);
    const primaryUrl = pickPrimaryMediaUrl(urls, media);

    if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) {
      return { status, payload: lastPayload, raw: lastRaw };
    }

    if (status === "STILL_RUNNING" || status === "PENDING" || status === "RUNNING") {
      if (primaryUrl) {
        return { status: "COMPLETED", payload: lastPayload, raw: lastRaw };
      }
      continue;
    }

    if (primaryUrl) {
      return { status: "COMPLETED", payload: lastPayload, raw: lastRaw };
    }
  }

  return { status: "STILL_RUNNING", payload: lastPayload, raw: lastRaw };
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
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          tool: toolName,
          details: generatePayload,
          raw: generateResult,
        },
        { status: 502 },
      );
    }

    const historyId = getHistoryId(generatePayload);
    if (!historyId) {
      return NextResponse.json(
        {
          error: "Generation started but no historyId was returned",
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          tool: toolName,
          details: generatePayload,
          raw: generateResult,
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
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        tool: toolName,
        details: generatePayload,
        raw: generateResult,
        pollAfterSeconds:
          typeof generatePayload.pollAfterSeconds === "number"
            ? generatePayload.pollAfterSeconds
            : 3,
      });
    }

    const waited = await waitForCreation(historyId, media);
    const urls = collectMediaUrls(waited.payload);
    const url = pickPrimaryMediaUrl(urls, media);
    const thumbnailUrl = pickThumbnailUrl(urls);
    const resolvedStatus =
      waited.status === "COMPLETED" && media === "video" && !url
        ? "STILL_RUNNING"
        : waited.status;

    return NextResponse.json({
      historyId,
      status: resolvedStatus,
      mediaType: media,
      mode,
      prompt,
      creditsUsed,
      url,
      thumbnailUrl,
      urls,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      tool: toolName,
      error:
        waited.status === "FAILED"
          ? String(waited.payload.error ?? waited.payload.message ?? "Generation failed")
          : undefined,
      details: {
        generate: generatePayload,
        wait: waited.payload,
      },
      raw: {
        generate: generateResult,
        wait: waited.raw,
      },
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          live: false,
          needsAuth: error.needsAuth,
          mcpEndpoint: MCP_ENDPOINT,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generation failed",
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { error },
      },
      { status: 500 },
    );
  }
}
