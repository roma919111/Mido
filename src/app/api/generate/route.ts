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
  createPixVerseVideoTask,
  isPixVerseConfigured,
  normalizePixVerseQuality,
  PIXVERSE_MODEL_ID,
  toPixVerseHistoryId,
  uploadPixVerseImage,
  waitForPixVerseVideoTask,
} from "@/lib/pixverse";
import {
  createBytePlusImage,
  resolveImageReference,
  VERONIX_IMAGE_MODEL_ID,
} from "@/lib/byteplus-image";
import { ensureClarityUrl, shouldApplyClarityGrade } from "@/lib/ensure-clarity";
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
import { normalizeVideoResolution } from "@/lib/byteplus-pricing";

const ALLOWED_VIDEO_RATIOS = new Set([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
]);

function normalizeVideoRatio(raw?: string | null): string {
  const r = String(raw || "16:9").trim();
  return ALLOWED_VIDEO_RATIOS.has(r) ? r : "16:9";
}
import { loadSyncedCatalog } from "@/lib/openart-catalog-sync";
import {
  buildSeedanceCharacterPrompt,
  orderCharacterRefsForBinding,
  stripInternalPromptNotes,
} from "@/lib/character-names";
import { toSemiRealisticScenePrompt } from "@/lib/reference-sanitize";
import { translateBytePlusError } from "@/lib/byteplus-errors";
import { saveLocalImage } from "@/lib/local-media";
import { warmVideoPosterBackground } from "@/lib/poster-cache";
import type { VisualReference } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Persist character stills as stable `/generations/…` paths so Assets → Edit
 * can restore the uploaded faces (data URLs / remote URLs blow sessionStorage).
 */
async function persistableReferenceImages(
  refs: VisualReference[] | undefined,
): Promise<VisualReference[] | undefined> {
  if (!Array.isArray(refs) || !refs.length) return undefined;
  const out: VisualReference[] = [];
  for (const r of refs.slice(0, 4)) {
    if (!r || typeof r.url !== "string" || !r.url.length) continue;
    if (r.url.startsWith("blob:")) continue;
    const label = String(r.label || "").slice(0, 40);
    const id = String(r.id || `ref-${Math.random().toString(36).slice(2, 8)}`);
    if (r.url.startsWith("/generations/")) {
      out.push({ type: "image", id, url: r.url, label });
      continue;
    }
    if (r.url.startsWith("data:image/")) {
      try {
        const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i.exec(r.url);
        if (!m?.[2]) continue;
        const bytes = Buffer.from(m[2], "base64");
        if (bytes.length < 32) continue;
        const saved = await saveLocalImage({
          bytes,
          contentType: m[1] || "image/jpeg",
          label: label || "character",
          prefix: "char",
        });
        out.push({
          type: "image",
          id: saved.visualReference.id || id,
          url: saved.localPath,
          label,
        });
      } catch {
        // skip unpersistable still
      }
      continue;
    }
    // http(s) — keep as-is (Edit can fetch); prefer not to re-download here
    out.push({ type: "image", id, url: r.url, label });
  }
  return out.length ? out : undefined;
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
    if (user.locked) {
      return NextResponse.json(
        {
          error:
            user.lockedReason?.trim() ||
            "تم إيقاف هذا الحساب. تواصل مع الدعم.",
          code: "account_locked",
        },
        { status: 403 },
      );
    }

    if (!isBytePlusConfigured()) {
      return NextResponse.json(
        {
          error: "توليد الوسائط عبر Veronix غير مُعدّ على السيرفر. راجع إعدادات المسؤول.",
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
          aspectRatio: String(body.aspectRatio || "1:1").trim() || "1:1",
          resolution:
            body.resolution && /^(1K|2K|4K)$/i.test(body.resolution)
              ? body.resolution.toUpperCase()
              : "2K",
          referenceImages: await persistableReferenceImages(
            Array.isArray(body.referenceImages) ? body.referenceImages : undefined,
          ),
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
    // Product: Veronix video — VYRONIX + optional PixVerse direct API.
    const allowedVideo = [VERONIX_MODEL_ID];
    if (isPixVerseConfigured()) allowedVideo.push(PIXVERSE_MODEL_ID);
    if (!modelIds.every((id) => allowedVideo.includes(id))) {
      return NextResponse.json(
        {
          error: isPixVerseConfigured()
            ? "الموديلات المتاحة: VYRONIX و PixVerse V6."
            : "الموديل المتاح حالياً هو VYRONIX فقط.",
        },
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
    // Persist character refs once — not once per variant (was repeating heavy I/O).
    const sharedSavedRefs = await persistableReferenceImages(
      Array.isArray(body.referenceImages) ? body.referenceImages : undefined,
    );
    for (const quote of billedQuotes) {
      const catalog = getCatalogModel(quote.modelId);
      const uiResolution = freeTrial
        ? FREE_VERONIX_RESOLUTION
        : normalizeVideoResolution(
            body.resolution || catalog?.resolutionDefault || "720p",
          );
      const bounds = durationBoundsForModel(catalog);
      const requestedDuration = body.duration ?? bounds.max;
      const modelDuration = freeTrial
        ? FREE_VERONIX_MODEL_DURATION_SECONDS
        : Math.min(bounds.max, Math.max(bounds.min, requestedDuration));

      const cleanPrompt = stripInternalPromptNotes(prompt);
      const savedRefs = sharedSavedRefs;
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
        aspectRatio: String(body.aspectRatio || "16:9").trim() || "16:9",
        resolution: uiResolution,
        referenceImages: savedRefs,
        preferClarity,
        generateAudio: freeTrial ? true : Boolean(body.generateAudio),
      });

      try {
        if (quote.modelId === PIXVERSE_MODEL_ID) {
          if (body.sequencePart) {
            throw new Error("PixVerse لا يدعم لقطات Multi-shot حالياً.");
          }

          const pixQuality = normalizePixVerseQuality(
            body.resolution || catalog?.resolutionDefault || "720p",
          );
          if (asset.resolution !== pixQuality) {
            await updateAsset(asset.id, user.id, { resolution: pixQuality });
          }

          let imgId: number | undefined;
          const startResolved = await ensureBytePlusRefUrl(body.startFrame);
          if (mode === "image2video" || Boolean(body.startFrame?.url)) {
            if (!body.startFrame?.url && !startResolved) {
              throw new Error(
                "ارفع Start Frame لتوليد فيديو PixVerse من صورة.",
              );
            }
            imgId = await uploadPixVerseImage(body.startFrame, startResolved);
          }

          const created = await createPixVerseVideoTask({
            prompt: cleanPrompt,
            duration: modelDuration,
            quality: pixQuality,
            aspectRatio: body.aspectRatio,
            generateAudio: Boolean(body.generateAudio),
            imgId,
          });

          let historyId = toPixVerseHistoryId(created.videoId);
          await updateAsset(asset.id, user.id, {
            historyId,
            url: "",
            status: "running",
            hidden: false,
            referenceImages: savedRefs,
          });

          if (body.waitForResult !== true && !body.sequencePart) {
            results.push({
              assetId: asset.id,
              modelId: quote.modelId,
              historyId,
              status: "running",
              urls: [] as string[],
              creditsUsed: quote.totalCredits,
              freeTrial: false,
              live: true,
              provider: "pixverse",
              tool: "pixverse_video_generate",
              quote,
            });
            continue;
          }

          const finished = await waitForPixVerseVideoTask(created.videoId, {
            timeoutMs: 240_000,
            intervalMs: 4_000,
          });
          const videoUrl = finished.url || "";
          if (videoUrl) {
            await updateAsset(asset.id, user.id, {
              historyId,
              url: videoUrl,
              status: "completed",
              error: undefined,
            });
            warmVideoPosterBackground({ url: videoUrl, historyId });
            results.push({
              assetId: asset.id,
              modelId: quote.modelId,
              historyId,
              status: "completed",
              urls: [videoUrl],
              creditsUsed: quote.totalCredits,
              freeTrial: false,
              live: true,
              provider: "pixverse",
              tool: "pixverse_video_generate",
              quote,
            });
            continue;
          }

          throw new Error("PixVerse completed without a video URL.");
        }

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
        if (referenceUrls.length) {
          console.info(
            `[veronix] character refs AI-filtered before BytePlus: ${referenceUrls.length}/${orderedRefList.length}`,
          );
        }

        // Seedance: character stills always use multimodal reference_image + @ImageN.
        // Stills are AI-digitized first; prompt is framed as digital AI characters.
        let finalPrompt = cleanPrompt;
        if (referenceUrls.length >= 1) {
          startUrl = null;
          lastUrl = null;
          finalPrompt = toSemiRealisticScenePrompt(
            buildSeedanceCharacterPrompt(cleanPrompt, keptRefs),
          );
        }

        if (refList.length > 0 && keptRefs.length === 0) {
          console.warn(
            "[veronix] character refs uploaded but none resolved for BytePlus",
            refList.map((r) => r.url?.slice(0, 48)),
          );
        }

        const videoRatio = normalizeVideoRatio(body.aspectRatio);
        // Keep stored aspectRatio in sync with what we send to BytePlus.
        if (asset.aspectRatio !== videoRatio) {
          await updateAsset(asset.id, user.id, { aspectRatio: videoRatio });
        }
        const createInput = {
          prompt: finalPrompt,
          duration: modelDuration,
          ratio: videoRatio,
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
          referenceImages: savedRefs || (await persistableReferenceImages(refList)),
        });

        /**
         * When CreateStudio sends waitForResult:false, return `running` as soon
         * as the BytePlus task id is persisted. Waiting ~90s *per variant* made
         * multi-generate hang the UI for minutes and blow Railway maxDuration.
         * Client + Assets poll finish the job.
         */
        if (body.waitForResult !== true && !body.sequencePart) {
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
          continue;
        }

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
          // Persist CDN immediately. Clarity runs async so 720p status polls
          // never hang / time out waiting on ffmpeg.
          await updateAsset(asset.id, user.id, {
            historyId,
            url: videoUrl,
            status: "completed",
            error: undefined,
            hidden: Boolean(body.sequencePart),
            preferClarity,
          });
          if (!body.sequencePart) {
            warmVideoPosterBackground({ url: videoUrl, historyId });
          }
          if (
            !body.sequencePart &&
            shouldApplyClarityGrade({
              preferClarity,
              resolution: uiResolution,
            })
          ) {
            void (async () => {
              try {
                const graded = await ensureClarityUrl(videoUrl);
                if (graded && graded !== videoUrl) {
                  await updateAsset(asset.id, user.id, { url: graded });
                  warmVideoPosterBackground({ url: graded, historyId });
                }
              } catch (err) {
                console.warn(
                  "[veronix] generate clarity skipped:",
                  err instanceof Error ? err.message : err,
                );
              }
            })();
          }
          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "completed",
            urls: [videoUrl],
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
                      "Veronix generation failed",
                  )
                : "Veronix generation failed";
          const errMsg = translateBytePlusError(rawErr);
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
        const raw = err instanceof Error ? err.message : "Veronix generation failed";
        const message = translateBytePlusError(raw);
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
