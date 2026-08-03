import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { updateAsset } from "@/lib/db";
import { resolveHistoryVideoUrl } from "@/lib/resolve-history-url";
import { cacheVideoLocally } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 180;

type Body = {
  videoUrl?: string;
  historyId?: string;
  assetId?: string;
  /** Apply OmarFX-style clarity grade on the cached file. */
  clarity?: boolean;
};

async function resolveHistoryUrl(historyId: string): Promise<string> {
  const url = await resolveHistoryVideoUrl(historyId);
  if (!url) {
    throw new Error("Unknown or incomplete history id");
  }
  return url;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    let videoUrl = body.videoUrl?.trim() || "";

    if (!videoUrl && body.historyId?.trim()) {
      videoUrl = await resolveHistoryUrl(body.historyId.trim());
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
        const refreshed = await resolveHistoryUrl(body.historyId.trim());
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "cache failed" },
      { status: 500 },
    );
  }
}
