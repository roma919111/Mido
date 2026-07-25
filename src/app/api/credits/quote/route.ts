import { NextResponse } from "next/server";
import { quoteMultipleModels } from "@/lib/credit-quote";
import { OpenArtConfigError } from "@/lib/openart-mcp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      modelIds?: string[];
      media?: "image" | "video";
      mode?: string;
      aspectRatio?: string;
      resolution?: string;
      duration?: number;
      generateAudio?: boolean;
    };

    const modelIds = body.modelIds?.filter(Boolean) ?? [];
    if (!modelIds.length) {
      return NextResponse.json({ error: "modelIds required" }, { status: 400 });
    }

    const media = body.media ?? "image";
    const result = await quoteMultipleModels(
      modelIds,
      {
        media,
        mode:
          body.mode ||
          (media === "image" ? "text2image" : "text2video"),
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        duration: body.duration,
        generateAudio: body.generateAudio,
      },
      { allowCache: true },
    );

    const allLive = result.quotes.every(
      (q) => (q.source === "openart" || q.source === "openart-cache") && q.available,
    );
    return NextResponse.json({
      ...result,
      source: allLive
        ? result.quotes.every((q) => q.source === "openart")
          ? "openart"
          : "openart-cache"
        : "mixed",
      liveOpenArt: allLive,
      synced: allLive,
    });
  } catch (error) {
    const needsOwnerSetup =
      error instanceof OpenArtConfigError ||
      (error instanceof Error &&
        (/not connected|غير متصل|setup\/openart/i.test(error.message) ||
          Boolean((error as { needsAuth?: boolean }).needsAuth)));

    // Use 422 (not 500) so Cloudflare tunnels don't replace the JSON body with HTML.
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Quote failed",
        needsOwnerSetup,
        synced: false,
        liveOpenArt: false,
      },
      { status: 422 },
    );
  }
}
