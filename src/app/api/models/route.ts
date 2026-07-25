import { NextResponse } from "next/server";
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  setLiveCatalogCache,
} from "@/lib/model-catalog";
import { getLiveCatalog } from "@/lib/openart-catalog-sync";
import { VERONIX_CREDIT_MULTIPLIER } from "@/lib/credit-quote";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("sync") === "1";

  try {
    const catalog = await getLiveCatalog({ forceSync: force });
    setLiveCatalogCache({ image: catalog.image, video: catalog.video });
    return NextResponse.json({
      image: catalog.image,
      video: catalog.video,
      maxSelect: 1,
      synced: catalog.live,
      syncedNow: catalog.syncedNow,
      updatedAt: catalog.updatedAt,
      multiplier: VERONIX_CREDIT_MULTIPLIER,
      source: catalog.source,
    });
  } catch (error) {
    // Fallback static catalog (still OpenArt-available set) so UI never goes empty.
    setLiveCatalogCache({ image: IMAGE_MODELS, video: VIDEO_MODELS });
    return NextResponse.json({
      image: IMAGE_MODELS,
      video: VIDEO_MODELS,
      maxSelect: 1,
      synced: false,
      syncedNow: false,
      multiplier: VERONIX_CREDIT_MULTIPLIER,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    });
  }
}
