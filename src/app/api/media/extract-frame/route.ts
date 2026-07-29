import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { saveLocalImage } from "@/lib/local-media";
import { extractLastFrameJpeg } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  videoUrl?: string;
  label?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const videoUrl = body.videoUrl?.trim();
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const jpeg = await extractLastFrameJpeg(videoUrl);
    const label = body.label?.trim() || `shot-frame-${Date.now()}`;
    const { localPath, visualReference } = await saveLocalImage({
      bytes: Buffer.from(jpeg),
      contentType: "image/jpeg",
      label,
      prefix: "frame",
    });

    return NextResponse.json({
      visualReference,
      url: visualReference.url || localPath,
      provider: "local",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "extract-frame failed" },
      { status: 500 },
    );
  }
}
