import { NextResponse } from "next/server";
import { quoteMultipleModels } from "@/lib/credit-quote";

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
    const result = await quoteMultipleModels(modelIds, {
      media,
      mode:
        body.mode ||
        (media === "image" ? "text2image" : "text2video"),
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      duration: body.duration,
      generateAudio: body.generateAudio,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quote failed" },
      { status: 500 },
    );
  }
}
