import { NextResponse } from "next/server";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/model-catalog";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";

export const runtime = "nodejs";

/** Customer catalog: Veronix video model only. */
export async function GET() {
  const veronix = VIDEO_MODELS.filter((m) => m.id === VERONIX_MODEL_ID && m.available);
  return NextResponse.json({
    image: [],
    video: veronix.length ? veronix : VIDEO_MODELS.filter((m) => m.id === VERONIX_MODEL_ID),
    maxSelect: 1,
    customerOnlyModel: VERONIX_MODEL_ID,
    // Full lists kept server-side for owner tooling / future unlock
    _allImageCount: IMAGE_MODELS.length,
    _allVideoCount: VIDEO_MODELS.length,
  });
}
