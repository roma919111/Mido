import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { createAsset } from "@/lib/db";
import { concatVideos } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  videoUrls?: string[];
  /** Save the stitched file as the visible Assets entry */
  saveAsset?: boolean;
  prompt?: string;
  modelId?: string;
  shotCount?: number;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const urls = Array.isArray(body.videoUrls)
      ? body.videoUrls.filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
      : [];
    if (urls.length < 2) {
      return NextResponse.json({ error: "Need at least 2 videoUrls" }, { status: 400 });
    }
    if (urls.length > 8) {
      return NextResponse.json({ error: "Too many clips (max 8)" }, { status: 400 });
    }

    const localUrl = await concatVideos(urls);

    let assetId: string | undefined;
    if (body.saveAsset !== false) {
      const shotCount = body.shotCount || urls.length;
      const promptText = (body.prompt || "").trim();
      const asset = await createAsset({
        userId: user.id,
        mediaType: "video",
        url: localUrl,
        prompt: promptText || `مشهد مدمج · ${shotCount} لقطات`,
        mode: "sequence-concat",
        // Distinct from seedance free-trial branding path
        model: "sequence-concat",
        creditsUsed: 0,
        status: "completed",
        hidden: false,
      });
      assetId = asset.id;
    }

    return NextResponse.json({
      url: localUrl,
      shotCount: urls.length,
      assetId,
      singleVideo: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "concat failed" },
      { status: 500 },
    );
  }
}
