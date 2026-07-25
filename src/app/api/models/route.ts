import { NextResponse } from "next/server";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/model-catalog";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    image: IMAGE_MODELS,
    video: VIDEO_MODELS,
    maxSelect: 1,
  });
}
