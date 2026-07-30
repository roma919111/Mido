import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { quoteMultipleModels } from "@/lib/credit-quote";
import {
  FREE_VERONIX_DURATION_SECONDS,
  isFreeVeronixEligible,
  VERONIX_MODEL_ID,
} from "@/lib/free-trial";
import { setLiveCatalogCache } from "@/lib/model-catalog";
import { loadSyncedCatalog } from "@/lib/openart-catalog-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const synced = await loadSyncedCatalog();
    if (synced) setLiveCatalogCache({ image: synced.image, video: synced.video });

    const body = (await request.json()) as {
      modelIds?: string[];
      media?: "image" | "video";
      mode?: string;
      aspectRatio?: string;
      resolution?: string;
      duration?: number;
      generateAudio?: boolean;
      /** When true, quote as paid multi-shot (never free trial). */
      multiShot?: boolean;
    };

    const modelIds = body.modelIds?.filter(Boolean) ?? [VERONIX_MODEL_ID];
    if (!modelIds.length) {
      return NextResponse.json({ error: "modelIds required" }, { status: 400 });
    }

    const media = body.media ?? "video";
    const duration = body.duration ?? FREE_VERONIX_DURATION_SECONDS;
    const result = await quoteMultipleModels(
      modelIds,
      {
        media,
        mode: body.mode || (media === "image" ? "text2image" : "text2video"),
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        duration,
        generateAudio: body.generateAudio,
      },
      { allowCache: true },
    );

    const user = await getCurrentUser();
    const freeTrial = isFreeVeronixEligible(user, {
      modelId: modelIds[0],
      media,
      duration,
      resolution: body.resolution,
      multiShot: Boolean(body.multiShot),
    });

    const quotes = result.quotes.map((q) => ({
      ...q,
      openArtCredits: q.openArtCredits,
      listPriceCredits: q.totalCredits,
      totalCredits: freeTrial ? 0 : q.totalCredits,
      unitCredits: freeTrial ? 0 : q.unitCredits,
      freeTrial,
      pricingNote: freeTrial
        ? `مجاني لأول مرة (مقدمة Veronix + ${FREE_VERONIX_DURATION_SECONDS} ثوانٍ · 480p مع صوت). السعر العادي بعد التجربة: ${q.totalCredits} كريدت.`
        : q.pricingNote,
    }));
    const totalCredits = quotes.reduce((sum, q) => sum + q.totalCredits, 0);

    const allReady = quotes.every(
      (q) =>
        q.available &&
        (q.source === "cache" ||
          q.source === "estimate" ||
          q.source === "openart" ||
          q.source === "openart-cache"),
    );
    const source =
      quotes.every((q) => q.source === "cache")
        ? "cache"
        : quotes.every((q) => q.source === "estimate")
          ? "estimate"
          : "mixed";

    return NextResponse.json({
      quotes,
      totalCredits,
      listPriceCredits: result.totalCredits,
      freeTrial,
      freeVeronixUsed: Boolean(user?.freeVeronixUsed),
      multiplier: result.multiplier,
      source,
      liveOpenArt: false,
      synced: allReady,
      provider: "byteplus",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Quote failed",
        needsOwnerSetup: false,
        synced: false,
        liveOpenArt: false,
        provider: "byteplus",
      },
      { status: 422 },
    );
  }
}
