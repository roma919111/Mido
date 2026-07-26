import { NextResponse } from "next/server";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  setLiveCatalogCache,
  type CatalogModel,
} from "@/lib/model-catalog";
import { getLiveCatalog } from "@/lib/openart-catalog-sync";
import { VERONIX_CREDIT_MULTIPLIER } from "@/lib/credit-quote";
import { isBytePlusConfigured } from "@/lib/byteplus-ark";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Product: Veronix-only video catalog; image studio paused. */
function productCatalog(video: CatalogModel[], image: CatalogModel[]) {
  const veronix =
    video.find((m) => m.id === VERONIX_MODEL_ID) ||
    VIDEO_MODELS.find((m) => m.id === VERONIX_MODEL_ID);
  const videoOut: CatalogModel[] = veronix
    ? [
        {
          ...veronix,
          name: "Veronix",
          available: true,
          badge: "حصري",
          tagline: isBytePlusConfigured()
            ? "Veronix · BytePlus Seedance Mini (OpenArt احتياط)"
            : veronix.tagline,
        },
      ]
    : VIDEO_MODELS.filter((m) => m.id === VERONIX_MODEL_ID).map((m) => ({
        ...m,
        available: true,
      }));

  // Image page paused until product re-enables it.
  const imageOut = image.map((m) => ({ ...m, available: false }));

  return { video: videoOut, image: imageOut };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("sync") === "1";

  try {
    const catalog = await getLiveCatalog({ forceSync: force });
    const shaped = productCatalog(catalog.video, catalog.image);
    setLiveCatalogCache({ image: shaped.image, video: shaped.video });
    return NextResponse.json({
      image: shaped.image,
      video: shaped.video,
      maxSelect: 1,
      synced: catalog.live,
      syncedNow: catalog.syncedNow,
      updatedAt: catalog.updatedAt,
      multiplier: VERONIX_CREDIT_MULTIPLIER,
      source: catalog.source,
      provider: isBytePlusConfigured() ? "byteplus+openart-fallback" : "openart",
      imageStudioEnabled: false,
    });
  } catch (error) {
    const shaped = productCatalog(VIDEO_MODELS, IMAGE_MODELS);
    setLiveCatalogCache({ image: shaped.image, video: shaped.video });
    return NextResponse.json({
      image: shaped.image,
      video: shaped.video,
      maxSelect: 1,
      synced: false,
      syncedNow: false,
      multiplier: VERONIX_CREDIT_MULTIPLIER,
      provider: isBytePlusConfigured() ? "byteplus+openart-fallback" : "openart",
      imageStudioEnabled: false,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    });
  }
}
