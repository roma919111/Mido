import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
  pickPrimaryMediaUrl,
  pickThumbnailUrl,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType") ?? "all";
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    const result = await callOpenArtTool("openart_creation_list", {
      mediaType,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20,
    });
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        {
          error: payload.rawText ?? "Failed to list creations",
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          details: payload,
          raw: result,
        },
        { status: 502 },
      );
    }

    const rawItems = (payload.items as unknown[]) ?? (payload.creations as unknown[]) ?? [];

    const items = rawItems.map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const urls = collectMediaUrls(row);
      const historyId = String(row.historyId ?? row.id ?? `item_${index}`);
      const media =
        String(
          row.mediaType ??
            row.type ??
            (urls.some((u) => /\.mp4|\.webm/i.test(u)) ? "video" : "image"),
        ).toLowerCase() === "video"
          ? "video"
          : "image";

      return {
        id: historyId,
        historyId,
        mediaType: media,
        url: pickPrimaryMediaUrl(urls, media),
        thumbnailUrl: pickThumbnailUrl(urls),
        prompt: String(row.prompt ?? row.title ?? ""),
        createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
        status: String(row.status ?? "COMPLETED").toLowerCase(),
      };
    });

    return NextResponse.json({
      configured: true,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      items,
      nextCursor: payload.nextCursor ?? null,
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
          items: [],
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list creations",
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        items: [],
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { error },
      },
      { status: 500 },
    );
  }
}
