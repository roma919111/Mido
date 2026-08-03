import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  collectMediaUrls,
  getResourceIds,
  OpenArtConfigError,
  parseToolPayload,
  pickPrimaryMediaUrl,
  pickThumbnailUrl,
  resolveGenerationMedia,
} from "@/lib/openart-mcp";
import { toPlaybackUrl } from "@/lib/media-proxy";

export const runtime = "nodejs";

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get("historyId");
  const mediaType = (searchParams.get("mediaType") ?? "video") as "image" | "video";

  if (!historyId) {
    return NextResponse.json({ error: "historyId is required" }, { status: 400 });
  }

  try {
    const result = await callOpenArtTool("openart_creation_get", { historyId });
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        {
          error: payload.rawText ?? "Failed to fetch status",
          historyId,
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          details: payload,
          raw: result,
        },
        { status: 502 },
      );
    }

    const status = String(payload.status ?? payload.state ?? "UNKNOWN").toUpperCase();
    const resolved = await resolveGenerationMedia([payload], mediaType, {
      attempts: 1,
      intervalMs: 0,
    });
    const urls = collectMediaUrls(payload);
    const url = resolved?.url ?? pickPrimaryMediaUrl(urls, mediaType);
    const thumbnailUrl = resolved?.thumbnailUrl ?? pickThumbnailUrl(urls);
    const playbackUrl = url ? toPlaybackUrl(url, mediaType) : "";
    const resolvedStatus =
      resolved?.status === "failed" || resolved?.status === "cancelled"
        ? resolved.status.toUpperCase()
        : url
          ? "COMPLETED"
          : status;

    return NextResponse.json({
      historyId,
      status: resolvedStatus,
      url,
      playbackUrl,
      thumbnailUrl,
      resourceIds: getResourceIds(payload),
      urls,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      pollAfterSeconds:
        typeof payload.pollAfterSeconds === "number" ? payload.pollAfterSeconds : undefined,
      error:
        status === "FAILED"
          ? String(payload.error ?? payload.message ?? "Generation failed")
          : undefined,
      details: payload,
      raw: result,
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
        error: error instanceof Error ? error.message : "Status check failed",
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
