import { NextResponse } from "next/server";
import {
  GeminiConfigError,
  generateGeminiVideo,
  isGeminiConfigured,
} from "@/lib/gemini-video";
import { buildGenerationParams, estimateCredits } from "@/lib/models";
import {
  callOpenArtTool,
  collectMediaUrls,
  getHistoryId,
  getResourceIds,
  OpenArtConfigError,
  parseToolPayload,
  pickPrimaryMediaUrl,
  pickThumbnailUrl,
  resolveGenerationMedia,
} from "@/lib/openart-mcp";
import { toPlaybackUrl } from "@/lib/media-proxy";
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
      if (media === "video" && status === "COMPLETED" && !primaryUrl) {
        continue;
      }
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
    const videoModel = body.videoModel ?? "pixverse";
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

    const creditsUsed = estimateCredits(mode, duration, quality, videoModel);

    const { model, toolMode, media, provider, params } = buildGenerationParams({
      mode,
      prompt,
      duration,
      quality,
      videoModel,
      startFrame: body.startFrame,
      referenceImage: body.referenceImage,
    });

    if (media === "video" && provider === "gemini") {
      if (!isGeminiConfigured()) {
        return NextResponse.json(
          {
            error:
              "Gemini Omni Flash is selected but GEMINI_API_KEY is not configured on the server.",
            live: false,
            provider: "gemini",
          },
          { status: 401 },
        );
      }

      if (!waitForResult) {
        return NextResponse.json(
          {
            error: "Gemini video generation requires waitForResult=true",
            provider: "gemini",
          },
          { status: 400 },
        );
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
        videoModel: "gemini-omni",
        tool: "gemini.interactions.create",
        live: true,
      });
    }

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
    const resolved = await resolveGenerationMedia(
      [generatePayload, waited.payload],
      media,
      { attempts: 36, intervalMs: 5000 },
    );

    const urls = collectMediaUrls(waited.payload);
    const url = resolved?.url ?? pickPrimaryMediaUrl(urls, media);
    const thumbnailUrl = resolved?.thumbnailUrl ?? pickThumbnailUrl(urls);
    const playbackUrl = url ? toPlaybackUrl(url, media) : "";
    const resolvedStatus =
      resolved?.status === "failed" || resolved?.status === "cancelled"
        ? resolved.status.toUpperCase()
        : url
          ? "COMPLETED"
          : waited.status === "COMPLETED" && media === "video"
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
      playbackUrl,
      thumbnailUrl,
      resourceIds: getResourceIds(generatePayload).length
        ? getResourceIds(generatePayload)
        : getResourceIds(waited.payload),
      urls,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      tool: toolName,
      error:
        resolvedStatus === "FAILED" || resolved?.status === "failed"
          ? String(
              resolved?.error ??
                waited.payload.error ??
                waited.payload.message ??
                "Generation failed",
            )
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
