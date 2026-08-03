import { NextResponse } from "next/server";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  mergeLiveIntoFullCatalog,
  setLiveCatalogCache,
  type CatalogModel,
} from "@/lib/model-catalog";
import { getLiveCatalog } from "@/lib/openart-catalog-sync";
import { VERONIX_CREDIT_MULTIPLIER } from "@/lib/credit-quote";
import { isBytePlusConfigured } from "@/lib/byteplus-ark";
import { isPixVerseConfigured, PIXVERSE_MODEL_ID } from "@/lib/pixverse";
import { VERONIX_IMAGE_MODEL_ID } from "@/lib/byteplus-image";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Studio catalog: full model list in UI; only VYRONIX + PixVerse generate live. */
function productCatalog(video: CatalogModel[], image: CatalogModel[]) {
  const merged = mergeLiveIntoFullCatalog({ image, video });

  const videoOut = merged.video.map((m) => {
    if (m.id === VERONIX_MODEL_ID) {
      return {
        ...m,
        name: "VYRONIX",
        available: isBytePlusConfigured(),
        badge: "حصري",
        tagline: isBytePlusConfigured()
          ? "تم إنشاؤه بواسطة VYRONIX"
          : m.tagline,
      };
    }
    if (m.id === PIXVERSE_MODEL_ID && isPixVerseConfigured()) {
      return {
        ...m,
        name: "PixVerse V6",
        available: true,
        badge: "تجربة",
        tagline: "API مباشر من PixVerse — Text/Image to Video",
      };
    }
    return { ...m, available: false };
  });

  const veronixImage =
    image.find((m) => m.id === VERONIX_IMAGE_MODEL_ID) ||
    IMAGE_MODELS.find((m) => m.id === VERONIX_IMAGE_MODEL_ID) ||
    IMAGE_MODELS.find((m) => m.id === "seedream-4-5");

  const imageOut: CatalogModel[] = veronixImage
    ? [
        {
          ...veronixImage,
          id: VERONIX_IMAGE_MODEL_ID,
          name: "VYRONIX",
          available: isBytePlusConfigured(),
          badge: "حصري",
          tagline: "تم إنشاؤه بواسطة VYRONIX",
          mcpId: veronixImage.mcpId || "byte-plus-seedream-4-5",
          modes: ["text2image", "image2image"],
        },
      ]
    : [
        {
          id: VERONIX_IMAGE_MODEL_ID,
          name: "VYRONIX",
          kind: "image" as const,
          mcpId: "byte-plus-seedream-4-5",
          modes: ["text2image", "image2image"],
          badge: "حصري",
          tagline: "تم إنشاؤه بواسطة VYRONIX",
          available: isBytePlusConfigured(),
        },
      ];

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
      provider:
        isBytePlusConfigured() || isPixVerseConfigured()
          ? isPixVerseConfigured() && !isBytePlusConfigured()
            ? "pixverse"
            : "byteplus"
          : "unconfigured",
      imageStudioEnabled: true,
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
      provider:
        isBytePlusConfigured() || isPixVerseConfigured()
          ? isPixVerseConfigured() && !isBytePlusConfigured()
            ? "pixverse"
            : "byteplus"
          : "unconfigured",
      imageStudioEnabled: true,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    });
  }
}
