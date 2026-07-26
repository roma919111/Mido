import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { updateAsset } from "@/lib/db";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import { cacheVideoLocally } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  videoUrl?: string;
  historyId?: string;
  assetId?: string;
  /** Apply OmarFX-style clarity grade on the cached file. */
  clarity?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    let videoUrl = body.videoUrl?.trim() || "";

    if (!videoUrl && body.historyId?.trim()) {
      const result = await callOpenArtTool("openart_creation_get", {
        historyId: body.historyId.trim(),
      });
      const payload = parseToolPayload(result);
      if (result.isError) {
        return NextResponse.json(
          { error: String(payload.error || "Failed to resolve historyId") },
          { status: 422 },
        );
      }
      videoUrl = collectMediaUrls(payload)[0] || "";
    }

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl or historyId is required" }, { status: 400 });
    }

    let localUrl: string;
    try {
      localUrl = await cacheVideoLocally(videoUrl, { clarity: Boolean(body.clarity) });
    } catch (firstErr) {
      // One more resolve via historyId when CDN fetch flaps.
      if (body.historyId?.trim()) {
        const result = await callOpenArtTool("openart_creation_get", {
          historyId: body.historyId.trim(),
        });
        const payload = parseToolPayload(result);
        const refreshed = collectMediaUrls(payload)[0] || "";
        if (refreshed && refreshed !== videoUrl) {
          localUrl = await cacheVideoLocally(refreshed, {
            clarity: Boolean(body.clarity),
          });
        } else {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }

    if (body.assetId?.trim()) {
      await updateAsset(body.assetId.trim(), user.id, {
        url: localUrl,
        status: "completed",
      });
    }

    return NextResponse.json({ url: localUrl, sourceUrl: videoUrl });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "cache failed" },
      { status: 500 },
    );
  }
}
