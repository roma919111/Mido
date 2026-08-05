import { NextResponse } from "next/server";
import { getGeminiImageStatus } from "@/lib/gemini-image";
import { getGeminiVideoStatus } from "@/lib/gemini-video";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get("historyId");
  const mediaType = (searchParams.get("mediaType") ?? "video") as "image" | "video";

  if (!historyId) {
    return NextResponse.json({ error: "historyId is required" }, { status: 400 });
  }

  const result =
    mediaType === "image"
      ? await getGeminiImageStatus(historyId)
      : await getGeminiVideoStatus(historyId);

  return NextResponse.json({
    historyId,
    status: result.status,
    url: result.url,
    playbackUrl: result.playbackUrl,
    provider: "gemini",
    pollAfterSeconds: result.status === "COMPLETED" ? undefined : 5,
    error: "error" in result ? result.error : undefined,
  });
}
