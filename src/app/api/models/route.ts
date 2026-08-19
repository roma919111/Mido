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
import { isSeedance2Configured, SEEDANCE_2_MODEL_ID, SEEDANCE_MINI_MODEL_ID } from "@/lib/byteplus-constants";
import { isPixVerseConfigured, PIXVERSE_MODEL_ID } from "@/lib/pixverse";
import {
  pixverseDurationMax,
  pixverseProductTagline,
} from "@/lib/pixverse-constants";
import {
  GEMINI_OMNI_FLASH_MODEL_ID,
  isGeminiVideoConfigured,
} from "@/lib/gemini-video";
import {
  isMiniMaxVideoConfigured,
  MINIMAX_H3_MODEL_ID,
} from "@/lib/minimax-video";
import {
  isKlingVideoConfigured,
  KLING_OMNI_MODEL_ID,
} from "@/lib/kling-video";
import {
  isFluxVideoConfigured,
  FLUX_VIDEO_MODEL_ID,
} from "@/lib/flux-video";
import { VERONIX_IMAGE_MODEL_ID } from "@/lib/byteplus-image";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Product: Vyronix (MiniMax branding) + Seedance Mini + other providers. */
function productCatalog(video: CatalogModel[], image: CatalogModel[]) {
  const videoOut: CatalogModel[] = [];

  if (isMiniMaxVideoConfigured()) {
    const minimaxTemplate =
      video.find((m) => m.id === MINIMAX_H3_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === MINIMAX_H3_MODEL_ID);
    const vyronixStatic = VIDEO_MODELS.find((m) => m.id === VERONIX_MODEL_ID);
    if (minimaxTemplate || vyronixStatic) {
      const mm = minimaxTemplate || vyronixStatic!;
      videoOut.push({
        ...mm,
        ...(vyronixStatic || {}),
        id: VERONIX_MODEL_ID,
        name: "VYRONIX",
        mcpId: "minimax-h3",
        modes: mm.modes ?? ["text2video", "image2video", "element2video"],
        available: true,
        badge: "حصري",
        tagline: "تم إنشاؤه بواسطة VYRONIX — أول فيديو مجاني (مقدمة + 4 ثوانٍ · 768P)",
        resolutions: mm.resolutions?.length ? mm.resolutions : ["768P", "2K"],
        resolutionDefault: mm.resolutionDefault || "768P",
        durationMin: mm.durationMin ?? 1,
        durationMax: mm.durationMax ?? 15,
        durationDefault: mm.durationDefault ?? 5,
        audioSupported: false,
        audioDefault: false,
        audioParam: null,
      });
    }
  }

  if (isBytePlusConfigured()) {
    const seedanceMini =
      video.find((m) => m.id === SEEDANCE_MINI_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === SEEDANCE_MINI_MODEL_ID);
    if (seedanceMini) {
      videoOut.push({
        ...seedanceMini,
        name: "Seedance 2 Mini",
        available: true,
        badge: "Seedance",
        tagline: "BytePlus Seedance 2 Mini — 480p / 720p · 4–15s",
      });
    }
  }

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
        tagline: "BytePlus Seedance 2.0 — 720p / 1080p / 4K · 4–15s",
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
        durationMin: 1,
        durationMax: pixverseDurationMax(),
        durationDefault: pixverse.durationDefault ?? 5,
        tagline: pixverseProductTagline(pixverse.tagline),
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

  if (isKlingVideoConfigured()) {
    const kling =
      video.find((m) => m.id === KLING_OMNI_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === KLING_OMNI_MODEL_ID);
    if (kling) {
      videoOut.push({
        ...kling,
        name: "Kling 3.0 Omni",
        available: true,
        badge: "Kling",
        tagline: "Kling Omni — 720p / 1080p / 4K · 3–15s",
      });
    }
  }

  if (isFluxVideoConfigured()) {
    const flux =
      video.find((m) => m.id === FLUX_VIDEO_MODEL_ID) ||
      VIDEO_MODELS.find((m) => m.id === FLUX_VIDEO_MODEL_ID);
    if (flux) {
      videoOut.push({
        ...flux,
        name: "FLUX 3",
        available: true,
        badge: "BFL",
        tagline: "Black Forest Labs — Draft / HD / FHD · 5–20 ث · صوت مضمّن",
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
      provider:
        isMiniMaxVideoConfigured() || isBytePlusConfigured()
          ? "configured"
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
        isMiniMaxVideoConfigured() || isBytePlusConfigured()
          ? "configured"
          : "unconfigured",
      imageStudioEnabled: true,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    });
  }
}
