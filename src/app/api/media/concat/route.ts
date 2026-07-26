import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { concatVideos } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  videoUrls?: string[];
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
    return NextResponse.json({ url: localUrl, shotCount: urls.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "concat failed" },
      { status: 500 },
    );
  }
}
