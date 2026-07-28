import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { adjustCredits, createAsset, updateAsset, updateUser } from "@/lib/db";
import { refundFailedAssetCredits } from "@/lib/credit-refund";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import {
  createBytePlusVideoTask,
  isBytePlusConfigured,
  mapBytePlusStatus,
  ensureBytePlusRefUrl,
  toBytePlusHistoryId,
  waitForBytePlusVideoTask,
} from "@/lib/byteplus-ark";
import {
  createBytePlusImage,
  resolveImageReference,
  VERONIX_IMAGE_MODEL_ID,
} from "@/lib/byteplus-image";
import { ensureClarityUrl } from "@/lib/ensure-clarity";
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
import {
  buildFirstFrameCharacterPrompt,
  buildSeedanceCharacterPrompt,
  orderCharacterRefsForBinding,
  stripInternalPromptNotes,
} from "@/lib/character-names";
import type { VisualReference } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function persistableReferenceImages(
  refs: VisualReference[] | undefined,
): VisualReference[] | undefined {
  if (!Array.isArray(refs) || !refs.length) return undefined;
  const kept = refs
    .filter((r) => r && typeof r.url === "string" && r.url.length > 0)
    .filter((r) => !r.url.startsWith("blob:"))
    .slice(0, 4)
    .map((r) => ({
      type: "image" as const,
      id: String(r.id || `ref-${Math.random().toString(36).slice(2, 8)}`),
      url: r.url,
      label: String(r.label || "").slice(0, 40),
    }));
  return kept.length ? kept : undefined;
}

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
  /** How many variants to generate (same prompt/model). Max 4. */
  count?: number;
  /** Customer opted into OmarFX clarity grade (slower). Default false. */
  clarity?: boolean;
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
          error: "توليد الوسائط عبر BytePlus غير مُعدّ على السيرفر (BYTEPLUS_API_KEY).",
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
    const variantCount = Math.min(
      4,
      Math.max(1, Math.floor(Number(body.count) || 1)),
    );
    const preferClarity = body.clarity === true;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (!modelIds.length) {
      return NextResponse.json({ error: "Select at least one model" }, { status: 400 });
    }

    // ——— Image studio (VYRONIX / Seedream) ———
    if (requestedMedia === "image") {
      if (!modelIds.every((id) => id === VERONIX_IMAGE_MODEL_ID || id === "seedream-4-5")) {
        return NextResponse.json(
          { error: "موديل الصور المتاح حالياً هو VYRONIX فقط." },
          { status: 422 },
        );
      }
      const imageModelIds = Array.from({ length: variantCount }, () => VERONIX_IMAGE_MODEL_ID);
      const mode =
        body.mode ||
        resolveToolMode(
          "image",
          false,
          Boolean(body.referenceImages?.length),
        );

      const quotes = [];
      for (const modelId of imageModelIds) {
        quotes.push(
          await quoteOpenArtCredits(
            {
              modelId,
              media: "image",
              mode,
              aspectRatio: body.aspectRatio || "1:1",
              resolution: body.resolution || "2K",
            },
            { allowCache: true },
          ),
        );
      }

      const billedQuotes = quotes.map((q) => ({
        ...q,
        modelId: VERONIX_IMAGE_MODEL_ID,
        freeTrial: false,
      }));
      const totalCredits = billedQuotes.reduce((s, q) => s + q.totalCredits, 0);
      const listPrice = quotes.reduce((s, q) => s + q.totalCredits, 0);

      if (user.credits <= 0) {
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
      if (user.credits < totalCredits) {
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

      if (totalCredits > 0) {
        await adjustCredits(user.id, -totalCredits);
      }

      // Mobile browsers often kill the tab if /api/create blocks 20–60s on Seedream.
      // Default: return running asset immediately and finish in `after()`.
      const waitNow = body.waitForResult === true;
      const results = [];
      for (const quote of billedQuotes) {
        const asset = await createAsset({
          userId: user.id,
          mediaType: "image",
          url: "",
          prompt,
          mode,
          model: VERONIX_IMAGE_MODEL_ID,
          creditsUsed: quote.totalCredits,
          status: "running",
        });
        const refUrl = await resolveImageReference(body.referenceImages);
        const size =
          body.resolution && /^(1K|2K|4K)$/i.test(body.resolution)
            ? body.resolution.toUpperCase()
            : "2K";

        const runImageJob = async () => {
          try {
            const created = await createBytePlusImage({
              prompt,
              size,
              watermark: false,
              referenceUrl: refUrl,
            });
            await updateAsset(asset.id, user.id, {
              url: created.url,
              status: "completed",
              error: undefined,
            });
            return {
              assetId: asset.id,
              modelId: VERONIX_IMAGE_MODEL_ID,
              status: "completed" as const,
              urls: [created.url],
              creditsUsed: quote.totalCredits,
              freeTrial: false,
              live: true,
              provider: "byteplus",
              tool: "byteplus_images_generations",
              quote,
            };
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Image generation failed";
            const refund = await refundFailedAssetCredits({
              userId: user.id,
              assetId: asset.id,
              errorMessage: msg,
            });
            return {
              assetId: asset.id,
              modelId: VERONIX_IMAGE_MODEL_ID,
              status: "failed" as const,
              error: refund.errorMessage,
              urls: [] as string[],
              creditsUsed: 0,
              creditsRefunded: refund.refunded,
              note: "تم استرجاع الكريديت",
              quote,
            };
          }
        };

        if (waitNow) {
          results.push(await runImageJob());
        } else {
          after(() => {
            void runImageJob();
          });
          results.push({
            assetId: asset.id,
            modelId: VERONIX_IMAGE_MODEL_ID,
            status: "running",
            urls: [] as string[],
            creditsUsed: quote.totalCredits,
            freeTrial: false,
            live: true,
            provider: "byteplus",
            tool: "byteplus_images_generations",
            quote,
          });
        }
      }

      const { findUserById } = await import("@/lib/db");
      const refreshed = await findUserById(user.id);
      return NextResponse.json({
        results,
        freeTrial: false,
        credits: refreshed?.credits ?? user.credits,
        provider: "byteplus",
        billing: "customer_wallet",
        imageStudioEnabled: true,
      });
    }

    // ——— Video studio (VYRONIX / Seedance) ———
    const media = "video" as const;
    // Product: Veronix video only (other models hidden).
    if (!modelIds.every((id) => id === VERONIX_MODEL_ID)) {
      return NextResponse.json(
        { error: "الموديل المتاح حالياً هو VYRONIX فقط." },
        { status: 422 },
      );
    }

    const mode =
      body.mode ||
      resolveToolMode(media, Boolean(body.startFrame), Boolean(body.referenceImages?.length));

    // Pricing may still use the cached OpenArt cost table; generation is BytePlus only.
    const quotes = [];
    for (let v = 0; v < variantCount; v += 1) {
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
    }

    // Free trial: stock Veronix intro + 4s Seedance clip (480p), once per account.
    // Never apply to multi-shot sequence parts (each beat is also 4s).
    // Free trial is a single clip only.
    const freeTrial =
      variantCount === 1 &&
      modelIds.length === 1 &&
      isFreeVeronixEligible(user, {
        modelId: modelIds[0],
        media,
        duration: body.duration,
        resolution: body.resolution,
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

      const cleanPrompt = stripInternalPromptNotes(prompt);
      const asset = await createAsset({
        userId: user.id,
        mediaType: media,
        url: "",
        prompt: cleanPrompt,
        // Tag intermediate beats so Assets recovery can treat them as stitch parts.
        mode: body.sequencePart ? "sequence-part" : mode,
        model: quote.modelId,
        creditsUsed: quote.totalCredits,
        status: "running",
        // Intermediate beats never appear in Assets — only the stitched final.
        hidden: Boolean(body.sequencePart),
        targetSeconds: modelDuration,
        referenceImages: persistableReferenceImages(
          Array.isArray(body.referenceImages) ? body.referenceImages : undefined,
        ),
        preferClarity,
      });

      try {
        const refList = (
          Array.isArray(body.referenceImages) ? body.referenceImages : []
        ).filter((r): r is VisualReference => Boolean(r?.url));
        let startUrl = await ensureBytePlusRefUrl(body.startFrame);
        let lastUrl = await ensureBytePlusRefUrl(body.endFrame);

        // Order must match @Image1..N in the Seedance prompt (mention order).
        const orderedRefList = orderCharacterRefsForBinding(
          cleanPrompt,
          refList,
        ).slice(0, 4);
        const keptRefs: VisualReference[] = [];
        const referenceUrls: string[] = [];
        for (const r of orderedRefList) {
          const u = await ensureBytePlusRefUrl(r);
          if (!u) continue;
          keptRefs.push(r);
          referenceUrls.push(u);
        }

        // Seedance mini: 1 character → first_frame (strongest face lock).
        // 2+ → multimodal reference_image with matching @ImageN order.
        let finalPrompt = cleanPrompt;
        if (referenceUrls.length === 1) {
          startUrl = referenceUrls[0]!;
          lastUrl = null;
          referenceUrls.length = 0;
          finalPrompt = buildFirstFrameCharacterPrompt(cleanPrompt, keptRefs[0]);
        } else if (referenceUrls.length > 1) {
          startUrl = null;
          lastUrl = null;
          finalPrompt = buildSeedanceCharacterPrompt(cleanPrompt, keptRefs);
        }

        if (refList.length > 0 && keptRefs.length === 0) {
          console.warn(
            "[veronix] character refs uploaded but none resolved for BytePlus",
            refList.map((r) => r.url?.slice(0, 48)),
          );
        }

        const createInput = {
          prompt: finalPrompt,
          duration: modelDuration,
          ratio: "16:9" as const,
          generateAudio: freeTrial ? true : Boolean(body.generateAudio),
          watermark: false,
          startFrameUrl: startUrl,
          lastFrameUrl: lastUrl,
          referenceImageUrls: referenceUrls.length ? [...referenceUrls] : [],
          imageRole: (startUrl ? "first_frame" : "reference_image") as
            | "first_frame"
            | "reference_image",
          resolution: uiResolution,
        };
        const created = await createBytePlusVideoTask(createInput);
        let historyId = toBytePlusHistoryId(created.id);
        await updateAsset(asset.id, user.id, {
          historyId,
          url: "",
          status: "running",
          hidden: Boolean(body.sequencePart),
          referenceImages: persistableReferenceImages(refList),
        });

        /**
         * CreateStudio sends waitForResult:false. We still do a short poll
         * (~90s) so typical 4s→~55s jobs finish in-request and privacy/mute
         * retries can run. Avoid the old 200–240s wait that blew Railway
         * maxDuration and left multi-shot cards stuck for 30+ minutes.
         */
        const waitMs = body.waitForResult === true ? 240_000 : 90_000;
        const finished = await waitForBytePlusVideoTask(created.id, {
          timeoutMs: body.sequencePart
            ? Math.min(waitMs, 90_000)
            : waitMs,
          intervalMs: 4_000,
          retryInput: createInput,
        });
        // Mute/privacy-retry may have created a new task id.
        if (finished.id && finished.id !== created.id) {
          historyId = toBytePlusHistoryId(finished.id);
        }
        const st = mapBytePlusStatus(finished.status);
        const videoUrl = finished.content?.video_url || "";

        if (videoUrl) {
          // Clarity only when the customer opted in (keeps Assets/generate fast).
          const finalUrl =
            body.sequencePart || !preferClarity
              ? videoUrl
              : await ensureClarityUrl(videoUrl);
          await updateAsset(asset.id, user.id, {
            historyId,
            url: finalUrl,
            status: "completed",
            error: undefined,
            hidden: Boolean(body.sequencePart),
            preferClarity,
          });
          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "completed",
            urls: [finalUrl],
            creditsUsed: quote.totalCredits,
            freeTrial,
            needsBrandOutro: freeTrial,
            preferClarity,
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
            ? "الصورة المرجعية رُفضت (شخص حقيقي). أعدنا كتابة الوصف كمشهد شبه واقعي وأعدنا التوليد — إن فشل مرة أخرى استخدم صورة مرسومة/AI أو احذف Start Frame."
            : rawErr;
          if (freeTrial) {
            await updateAsset(asset.id, user.id, {
              historyId,
              status: "failed",
              error: errMsg,
              hidden: Boolean(body.sequencePart),
            });
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
          await updateAsset(asset.id, user.id, {
            historyId,
            hidden: Boolean(body.sequencePart),
          });
          const refund = await refundFailedAssetCredits({
            userId: user.id,
            assetId: asset.id,
            errorMessage: errMsg,
          });
          results.push({
            modelId: quote.modelId,
            assetId: asset.id,
            historyId,
            error: refund.errorMessage,
            creditsUsed: 0,
            creditsRefunded: refund.refunded,
            note: "تم استرجاع الكريديت",
            freeTrial,
            provider: "byteplus",
          });
          continue;
        }

        // Still running after short wait — client / Assets poll finishes it.
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
          ? "الصورة المرجعية رُفضت (شخص حقيقي). أعدنا كتابة الوصف كمشهد شبه واقعي تلقائياً — إن فشل استخدم صورة مرسومة/AI أو احذف Start Frame."
          : raw;
        console.error("[veronix] BytePlus generation failed (no OpenArt fallback):", raw);
        if (freeTrial) {
          await updateAsset(asset.id, user.id, {
            status: "failed",
            error: message,
            hidden: Boolean(body.sequencePart),
          });
          results.push({
            modelId: quote.modelId,
            assetId: asset.id,
            error: message,
            creditsUsed: 0,
            freeTrial,
            provider: "byteplus",
          });
        } else {
          await updateAsset(asset.id, user.id, {
            hidden: Boolean(body.sequencePart),
          });
          const refund = await refundFailedAssetCredits({
            userId: user.id,
            assetId: asset.id,
            errorMessage: message,
          });
          results.push({
            modelId: quote.modelId,
            assetId: asset.id,
            error: refund.errorMessage,
            creditsUsed: 0,
            creditsRefunded: refund.refunded,
            note: "تم استرجاع الكريديت",
            freeTrial,
            provider: "byteplus",
          });
        }
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
