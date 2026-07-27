import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { adjustCredits, createAsset, updateAsset, updateUser } from "@/lib/db";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import {
  createBytePlusVideoTask,
  isBytePlusConfigured,
  mapBytePlusStatus,
  resolvePublicMediaUrl,
  toBytePlusHistoryId,
  waitForBytePlusVideoTask,
} from "@/lib/byteplus-ark";
import { stylizeReferenceImage } from "@/lib/reference-sanitize";
import {
  FREE_VERONIX_MODEL_DURATION_SECONDS,
  FREE_VERONIX_RESOLUTION,
  isFreeVeronixEligible,
  VERONIX_MODEL_ID,
} from "@/lib/free-trial";
import {
  durationBoundsForModel,
  getCatalogModel,
  setLiveCatalogCache,
} from "@/lib/model-catalog";
import { loadSyncedCatalog } from "@/lib/openart-catalog-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

type GenBody = {
  modelIds?: string[];
  media?: "image" | "video";
  mode?: string;
  prompt?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  generateAudio?: boolean;
  startFrame?: import("@/lib/types").VisualReference | null;
  endFrame?: import("@/lib/types").VisualReference | null;
  referenceImages?: import("@/lib/types").VisualReference[];
  waitForResult?: boolean;
  /** Intermediate multi-shot clip — hidden from Assets; final stitch is shown */
  sequencePart?: boolean;
};

function resolveToolMode(media: "image" | "video", hasStart: boolean, hasRefs: boolean) {
  if (media === "image") return hasRefs ? "image2image" : "text2image";
  if (hasStart) return "image2video";
  return "text2video";
}

export async function POST(request: Request) {
  try {
    const synced = await loadSyncedCatalog();
    if (synced) setLiveCatalogCache({ image: synced.image, video: synced.video });

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Login required", needsAuth: true, needsPaywall: true },
        { status: 401 },
      );
    }

    if (!isBytePlusConfigured()) {
      return NextResponse.json(
        {
          error: "توليد الفيديو عبر BytePlus غير مُعدّ على السيرفر (BYTEPLUS_API_KEY).",
          provider: "byteplus",
          needsOwnerSetup: true,
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as GenBody;
    const prompt = body.prompt?.trim();
    const requestedMedia = body.media ?? "video";
    const modelIds = [...new Set(body.modelIds?.filter(Boolean) ?? [])].slice(0, 4);

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (requestedMedia === "image") {
      return NextResponse.json(
        {
          error: "توليد الصور متوقف مؤقتاً — استخدم استوديو الفيديو (Veronix).",
          imageStudioEnabled: false,
        },
        { status: 403 },
      );
    }
    const media = "video" as const;
    if (!modelIds.length) {
      return NextResponse.json({ error: "Select at least one model" }, { status: 400 });
    }
    // Product: Veronix video only (other models hidden).
    if (!modelIds.every((id) => id === VERONIX_MODEL_ID)) {
      return NextResponse.json(
        { error: "الموديل المتاح حالياً هو Veronix فقط." },
        { status: 422 },
      );
    }

    const mode =
      body.mode ||
      resolveToolMode(media, Boolean(body.startFrame), Boolean(body.referenceImages?.length));

    // Pricing may still use the cached OpenArt cost table; generation is BytePlus only.
    const quotes = [];
    for (const modelId of modelIds) {
      quotes.push(
        await quoteOpenArtCredits(
          {
            modelId,
            media,
            mode,
            aspectRatio: body.aspectRatio,
            resolution: body.resolution,
            duration: body.duration,
            generateAudio: body.generateAudio,
          },
          { allowCache: true },
        ),
      );
    }

    // Free trial: stock Veronix intro + 4s Seedance clip (480p), once per account.
    // Never apply to multi-shot sequence parts (each beat is also 4s).
    const freeTrial =
      modelIds.length === 1 &&
      isFreeVeronixEligible(user, {
        modelId: modelIds[0],
        media,
        duration: body.duration,
        sequencePart: Boolean(body.sequencePart),
        multiShot: Boolean(body.sequencePart),
      });

    const billedQuotes = quotes.map((q) => ({
      ...q,
      totalCredits: freeTrial ? 0 : q.totalCredits,
      unitCredits: freeTrial ? 0 : q.unitCredits,
      freeTrial,
    }));
    const totalCredits = billedQuotes.reduce((s, q) => s + q.totalCredits, 0);
    const listPrice = quotes.reduce((s, q) => s + q.totalCredits, 0);

    if (!freeTrial && user.credits <= 0) {
      return NextResponse.json(
        {
          error: "رصيدك صفر. أضف كريدت أو رقِّ الباقة للمتابعة.",
          needsPaywall: true,
          credits: user.credits,
          requiredCredits: listPrice,
          quotes: billedQuotes,
        },
        { status: 402 },
      );
    }

    if (!freeTrial && user.credits < totalCredits) {
      return NextResponse.json(
        {
          error: "رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة للمتابعة.",
          needsPaywall: true,
          credits: user.credits,
          requiredCredits: totalCredits,
          quotes: billedQuotes,
        },
        { status: 402 },
      );
    }

    const unavailable = quotes.filter((q) => !q.available);
    if (unavailable.length) {
      return NextResponse.json(
        {
          error: `هذه الموديلات غير متاحة للتوليد حاليًا على Veronix: ${unavailable
            .map((q) => q.modelId)
            .join(", ")}`,
          quotes: billedQuotes,
        },
        { status: 422 },
      );
    }

    if (freeTrial) {
      await updateUser(user.id, { freeVeronixUsed: true });
    } else if (totalCredits > 0) {
      await adjustCredits(user.id, -totalCredits);
    }

    const results = [];
    for (const quote of billedQuotes) {
      const catalog = getCatalogModel(quote.modelId);
      const uiResolution = freeTrial
        ? FREE_VERONIX_RESOLUTION
        : body.resolution || catalog?.resolutionDefault || "720p";
      const bounds = durationBoundsForModel(catalog);
      const requestedDuration = body.duration ?? bounds.max;
      const modelDuration = freeTrial
        ? FREE_VERONIX_MODEL_DURATION_SECONDS
        : Math.min(bounds.max, Math.max(bounds.min, requestedDuration));

      const asset = await createAsset({
        userId: user.id,
        mediaType: media,
        url: "",
        prompt,
        // Tag intermediate beats so Assets recovery can treat them as stitch parts.
        mode: body.sequencePart ? "sequence-part" : mode,
        model: quote.modelId,
        creditsUsed: quote.totalCredits,
        status: "running",
        // Intermediate beats never appear in Assets — only the stitched final.
        hidden: Boolean(body.sequencePart),
        targetSeconds: modelDuration,
      });

      try {
        let startUrl = resolvePublicMediaUrl(body.startFrame);
        // Creative pipeline: stylize real-photo start frames before Ark sees them
        // to avoid InputImageSensitiveContentDetected / PrivacyInformation blocks.
        if (startUrl) {
          try {
            startUrl = await stylizeReferenceImage(startUrl);
          } catch (styleErr) {
            console.warn(
              "[veronix] proactive reference stylize skipped:",
              styleErr instanceof Error ? styleErr.message : styleErr,
            );
          }
        }
        const createInput = {
          prompt,
          duration: modelDuration,
          ratio: "16:9" as const,
          generateAudio: freeTrial ? true : Boolean(body.generateAudio),
          watermark: false,
          startFrameUrl: startUrl,
          imageRole: "first_frame" as const,
          resolution: uiResolution,
        };
        const created = await createBytePlusVideoTask(createInput);
        let historyId = toBytePlusHistoryId(created.id);
        await updateAsset(asset.id, user.id, {
          historyId,
          url: "",
          status: "running",
          hidden: Boolean(body.sequencePart),
        });

        // Wait for the MP4 so Assets gets a real URL in this same request.
        const finished = await waitForBytePlusVideoTask(created.id, {
          timeoutMs: body.sequencePart ? 200_000 : 240_000,
          intervalMs: 5_000,
          retryInput: createInput,
        });
        // Mute-retry may have created a new task id.
        if (finished.id && finished.id !== created.id) {
          historyId = toBytePlusHistoryId(finished.id);
        }
        const st = mapBytePlusStatus(finished.status);
        const videoUrl = finished.content?.video_url || "";

        if (videoUrl) {
          await updateAsset(asset.id, user.id, {
            historyId,
            url: videoUrl,
            status: "completed",
            error: undefined,
            hidden: Boolean(body.sequencePart),
          });
          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "completed",
            urls: [videoUrl],
            creditsUsed: quote.totalCredits,
            freeTrial,
            needsBrandOutro: freeTrial,
            live: true,
            provider: "byteplus",
            tool: "byteplus_contents_generations",
            quote,
          });
          continue;
        }

        if (st === "FAILED") {
          const rawErr =
            typeof finished.error === "string"
              ? finished.error
              : finished.error && typeof finished.error === "object"
                ? String(
                    finished.error.message ||
                      finished.error.code ||
                      "BytePlus generation failed",
                  )
                : "BytePlus generation failed";
          const errMsg = /InputImageSensitive|PrivacyInformation|real person/i.test(
            rawErr,
          )
            ? "الصورة المرجعية رُفضت لأنها تبدو كشخص حقيقي. أعدنا معالجتها تلقائياً بأسلوب فني — إن استمر الرفض جرّب صورة مرسومة/AI أو ولّد بدون Start Frame."
            : rawErr;
          await updateAsset(asset.id, user.id, {
            historyId,
            status: "failed",
            error: errMsg,
            hidden: Boolean(body.sequencePart),
          });
          if (!freeTrial && quote.totalCredits > 0) {
            await adjustCredits(user.id, quote.totalCredits);
          }
          results.push({
            modelId: quote.modelId,
            assetId: asset.id,
            historyId,
            error: errMsg,
            creditsUsed: 0,
            freeTrial,
            provider: "byteplus",
          });
          continue;
        }

        // Still running after timeout — leave running for Assets poll.
        results.push({
          assetId: asset.id,
          modelId: quote.modelId,
          historyId,
          status: "running",
          urls: [] as string[],
          creditsUsed: quote.totalCredits,
          freeTrial,
          needsBrandOutro: freeTrial,
          live: true,
          provider: "byteplus",
          tool: "byteplus_contents_generations",
          quote,
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : "BytePlus generation failed";
        const message = /InputImageSensitive|PrivacyInformation|real person/i.test(raw)
          ? "الصورة المرجعية رُفضت لأنها تبدو كشخص حقيقي. نعيد معالجتها بأسلوب فني تلقائياً — إن فشل مرة أخرى استخدم صورة مرسومة/AI أو احذف Start Frame."
          : raw;
        console.error("[veronix] BytePlus generation failed (no OpenArt fallback):", raw);
        await updateAsset(asset.id, user.id, {
          status: "failed",
          error: message,
          hidden: Boolean(body.sequencePart),
        });
        if (!freeTrial && quote.totalCredits > 0) {
          await adjustCredits(user.id, quote.totalCredits);
        }
        results.push({
          modelId: quote.modelId,
          assetId: asset.id,
          error: message,
          creditsUsed: 0,
          freeTrial,
          provider: "byteplus",
        });
      }
    }

    const refreshed = await getCurrentUser();
    return NextResponse.json({
      results,
      totalCreditsQuoted: totalCredits,
      freeTrial,
      creditsRemaining: refreshed?.credits ?? 0,
      freeVeronixUsed: Boolean(refreshed?.freeVeronixUsed),
      live: true,
      provider: "byteplus",
      billing: freeTrial ? "free_veronix_trial" : "customer_wallet",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
