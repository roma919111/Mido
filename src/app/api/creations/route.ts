import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  collectMediaUrls,
  isOpenArtConfigured,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType") ?? "all";
  const limit = Number(searchParams.get("limit") ?? "20");

  if (!isOpenArtConfigured()) {
    return NextResponse.json({
      configured: false,
      items: [],
      message: "Connect OPENART_ACCESS_TOKEN to load your OpenArt creation history.",
    });
  }

  try {
    const result = await callOpenArtTool("openart_creation_list", {
      mediaType,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20,
    });
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        { error: payload.rawText ?? "Failed to list creations" },
        { status: 502 },
      );
    }

    const rawItems = (payload.items as unknown[]) ?? (payload.creations as unknown[]) ?? [];

    const items = rawItems.map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const urls = collectMediaUrls(row);
      const historyId = String(row.historyId ?? row.id ?? `item_${index}`);
      const media =
        String(row.mediaType ?? row.type ?? (urls.some((u) => /\.mp4|\.webm/i.test(u)) ? "video" : "image")).toLowerCase() ===
        "video"
          ? "video"
          : "image";

      return {
        id: historyId,
        historyId,
        mediaType: media,
        url: urls[0] ?? "",
        thumbnailUrl: urls.find((u) => /thumb|cover|image/i.test(u)) ?? urls[0],
        prompt: String(row.prompt ?? row.title ?? ""),
        createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
        status: String(row.status ?? "COMPLETED").toLowerCase(),
      };
    });

    return NextResponse.json({
      configured: true,
      items,
      nextCursor: payload.nextCursor ?? null,
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list creations" },
      { status: 500 },
    );
  }
}
