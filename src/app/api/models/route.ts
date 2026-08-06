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
import { isSeedance2Configured, SEEDANCE_2_MODEL_ID } from "@/lib/byteplus-constants";
import { isPixVerseConfigured, PIXVERSE_MODEL_ID } from "@/lib/pixverse";
import {
  GEMINI_OMNI_FLASH_MODEL_ID,
  isGeminiVideoConfigured,
} from "@/lib/gemini-video";
import {
  isMiniMaxVideoConfigured,
  MINIMAX_H3_MODEL_ID,
} from "@/lib/minimax-video";
import { VERONIX_IMAGE_MODEL_ID } from "@/lib/byteplus-image";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Product: Veronix video + VYRONIX image (BytePlus Seedream under the hood). */
function productCatalog(video: CatalogModel[], image: CatalogModel[]) {
  const veronixVideo =
    video.find((m) => m.id === VERONIX_MODEL_ID) ||
    VIDEO_MODELS.find((m) => m.id === VERONIX_MODEL_ID);
  const videoOut: CatalogModel[] = veronixVideo
    ? [
        {
          ...veronixVideo,
          name: "VYRONIX",
          available: true,
          badge: "حصري",
          tagline: isBytePlusConfigured()
            ? "تم إنشاؤه بواسطة VYRONIX"
            : veronixVideo.tagline,
        },
      ]
    : VIDEO_MODELS.filter((m) => m.id === VERONIX_MODEL_ID).map((m) => ({
        ...m,
        name: "VYRONIX",
        available: true,
      }));

  if (isSeedance2Configured()) {
    const seedance2 =
      video.find((m) => m.id === SEEDANCE_2_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === SEEDANCE_2_MODEL_ID);
    if (seedance2) {
      videoOut.push({
        ...seedance2,
        name: "Seedance 2.0",
        available: true,
        badge: "Seedance",
        tagline: "BytePlus Seedance 2.0 — صورة / فيديو / صوت مرجعي (4–15s)",
      });
    }
  }

  if (isPixVerseConfigured()) {
    const pixverse =
      video.find((m) => m.id === PIXVERSE_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === PIXVERSE_MODEL_ID);
    if (pixverse) {
      videoOut.push({
        ...pixverse,
        name: "PixVerse V6",
        available: true,
        badge: "تجربة",
      });
    }
  }

  if (isGeminiVideoConfigured()) {
    const gemini =
      video.find((m) => m.id === GEMINI_OMNI_FLASH_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === GEMINI_OMNI_FLASH_MODEL_ID);
    if (gemini) {
      videoOut.push({
        ...gemini,
        name: "Gemini Omni Flash",
        available: true,
        badge: "Gemini",
        tagline: "Google Gemini — text / image to video (3–10s)",
      });
    }
  }

  if (isMiniMaxVideoConfigured()) {
    const minimax =
      video.find((m) => m.id === MINIMAX_H3_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === MINIMAX_H3_MODEL_ID);
    if (minimax) {
      videoOut.push({
        ...minimax,
        name: "MiniMax H3",
        available: true,
        badge: "MiniMax",
        tagline: "MiniMax H series — 768P / 2K (1–15s)",
      });
    }
  }

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
      provider: isBytePlusConfigured() ? "byteplus" : "unconfigured",
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
      provider: isBytePlusConfigured() ? "byteplus" : "unconfigured",
      imageStudioEnabled: true,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    });
  }
}
