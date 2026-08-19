import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { adjustCredits, createAsset, findAssetById, updateAsset, updateUser } from "@/lib/db";
import { refundFailedAssetCredits } from "@/lib/credit-refund";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import {
  createBytePlusVideoTask,
  isBytePlusConfigured,
  mapBytePlusStatus,
  ensureBytePlusRefUrl,
  ensureBytePlusPublicMediaUrl,
  ensurePlainRefUrl,
  toBytePlusHistoryId,
  waitForBytePlusVideoTask,
} from "@/lib/byteplus-ark";
import { isSeedance2Configured, isSeedance2FamilyModel, SEEDANCE_2_MODEL_ID, SEEDANCE_MINI_MODEL_ID } from "@/lib/byteplus-constants";
import {
  createPixVerseVideoTask,
  createPixVerseFusionTask,
  isPixVerseConfigured,
  normalizePixVerseQuality,
  PIXVERSE_MODEL_ID,
  toPixVerseHistoryId,
  uploadPixVerseImage,
  uploadPixVerseVideo,
  waitForPixVerseVideoTask,
  translatePixVerseError,
  type PixVerseFusionImageRef,
} from "@/lib/pixverse";
import {
  ensurePixVerseExtendBackground,
  needsPixVerseExtend,
  splitPixVerseDuration,
  startPixVerseClip,
  PIXVERSE_EXTEND_MODE,
  type PixVerseExtendJobMeta,
} from "@/lib/pixverse-extend";
import { pixverseDurationMax, PIXVERSE_NATIVE_MAX_DURATION } from "@/lib/pixverse-constants";
import { isPixVerseModel } from "@/lib/pixverse-pricing";
import {
  createGeminiVideoInteraction,
  finalizeGeminiVideoJob,
  GEMINI_OMNI_FLASH_MODEL_ID,
  isGeminiVideoConfigured,
  toGeminiHistoryId,
} from "@/lib/gemini-video";
import { clampGeminiVideoDuration } from "@/lib/gemini-pricing";
import {
  createMiniMaxVideoTask,
  finalizeMiniMaxVideoJob,
  isMiniMaxVideoConfigured,
  MINIMAX_H3_MODEL_ID,
  toMiniMaxHistoryId,
} from "@/lib/minimax-video";
import {
  createKlingOmniVideoTask,
  finalizeKlingVideoJob,
  isKlingVideoConfigured,
  KLING_OMNI_MODEL_ID,
  toKlingHistoryId,
} from "@/lib/kling-video";
import {
  clampKlingOmniDuration,
  normalizeKlingOmniQuality,
} from "@/lib/kling-pricing";
import {
  createFluxVideoTask,
  finalizeFluxVideoJob,
  isFluxVideoConfigured,
  toFluxHistoryId,
} from "@/lib/flux-video";
import { FLUX_VIDEO_MODEL_ID } from "@/lib/flux-constants";
import {
  clampFluxVideoDuration,
  normalizeFluxVideoQuality,
} from "@/lib/flux-pricing";
import {
  clampMiniMaxH3Duration,
  normalizeMiniMaxH3Quality,
  usesMiniMaxVideoBackend,
} from "@/lib/minimax-pricing";
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
import {
  checkSufficientCredits,
  INSUFFICIENT_CREDITS_ERROR,
} from "@/lib/video-credits";

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
import { translateBytePlusError, translateGeminiError } from "@/lib/byteplus-errors";
import { saveLocalImage } from "@/lib/local-media";
import { warmVideoPosterBackground } from "@/lib/poster-cache";
import type { VisualReference } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 800;

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
  referenceVideos?: import("@/lib/types").VisualReference[];
  referenceAudios?: import("@/lib/types").VisualReference[];
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

    const body = (await request.json()) as GenBody;
    const requestedMedia = body.media ?? "video";

    if (
      requestedMedia === "image" &&
      !isBytePlusConfigured()
    ) {
      return NextResponse.json(
        {
          error: "توليد الوسائط عبر Veronix غير مُعدّ على السيرفر. راجع إعدادات المسؤول.",
          provider: "byteplus",
          needsOwnerSetup: true,
        },
        { status: 503 },
      );
    }

    if (
      requestedMedia === "video" &&
      !isBytePlusConfigured() &&
      !isPixVerseConfigured() &&
      !isGeminiVideoConfigured() &&
      !isMiniMaxVideoConfigured() &&
      !isKlingVideoConfigured() &&
      !isFluxVideoConfigured()
    ) {
      return NextResponse.json(
        {
          error:
            "لا يوجد مزود فيديو مُعدّ على السيرفر (BytePlus / PixVerse / Gemini / MiniMax / Kling / FLUX).",
          provider: "video",
          needsOwnerSetup: true,
        },
        { status: 503 },
      );
    }

    const prompt = body.prompt?.trim();
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

      const imageBalance = checkSufficientCredits(user.credits, totalCredits);
      if (!imageBalance.ok) {
        return NextResponse.json(
          {
            error: INSUFFICIENT_CREDITS_ERROR,
            messageAr:
              user.credits <= 0
                ? "رصيدك صفر. أضف كريدت أو رقِّ الباقة للمتابعة."
                : "رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة للمتابعة.",
            needsPaywall: true,
            credits: imageBalance.balance,
            requiredCredits: imageBalance.requiredCredits,
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
    const allowedVideo: string[] = [];
    if (isMiniMaxVideoConfigured()) {
      allowedVideo.push(VERONIX_MODEL_ID);
      allowedVideo.push(MINIMAX_H3_MODEL_ID);
    }
    if (isBytePlusConfigured()) allowedVideo.push(SEEDANCE_MINI_MODEL_ID);
    if (isSeedance2Configured()) allowedVideo.push(SEEDANCE_2_MODEL_ID);
    if (isPixVerseConfigured()) allowedVideo.push(PIXVERSE_MODEL_ID);
    if (isGeminiVideoConfigured()) allowedVideo.push(GEMINI_OMNI_FLASH_MODEL_ID);
    if (isKlingVideoConfigured()) allowedVideo.push(KLING_OMNI_MODEL_ID);
    if (isFluxVideoConfigured()) allowedVideo.push(FLUX_VIDEO_MODEL_ID);
    if (!allowedVideo.length) {
      return NextResponse.json(
        {
          error: "لا يوجد مزود فيديو مُعدّ على السيرفر.",
          provider: "video",
          needsOwnerSetup: true,
        },
        { status: 503 },
      );
    }
    if (!modelIds.every((id) => allowedVideo.includes(id))) {
      return NextResponse.json(
        {
          error:
            allowedVideo.length > 1
              ? `الموديلات المتاحة: ${allowedVideo.join(" · ")}.`
              : allowedVideo[0] === VERONIX_MODEL_ID
                ? "الموديل المتاح حالياً هو VYRONIX فقط."
                : "الموديل المختار غير متاح على السيرفر.",
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
              hasVideoReferences:
                (modelId === PIXVERSE_MODEL_ID ||
                  isSeedance2FamilyModel(modelId) ||
                  modelId === FLUX_VIDEO_MODEL_ID) &&
                Array.isArray(body.referenceVideos) &&
                body.referenceVideos.some((r) => r?.url),
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

    if (!freeTrial) {
      const videoBalance = checkSufficientCredits(user.credits, totalCredits);
      if (!videoBalance.ok) {
        return NextResponse.json(
          {
            error: INSUFFICIENT_CREDITS_ERROR,
            messageAr:
              user.credits <= 0
                ? "رصيدك صفر. أضف كريدت أو رقِّ الباقة للمتابعة."
                : "رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة للمتابعة.",
            needsPaywall: true,
            credits: videoBalance.balance,
            requiredCredits: videoBalance.requiredCredits,
            quotes: billedQuotes,
          },
          { status: 402 },
        );
      }
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
        : quote.modelId === PIXVERSE_MODEL_ID
          ? normalizePixVerseQuality(
              body.resolution || catalog?.resolutionDefault || "720p",
            )
          : usesMiniMaxVideoBackend(quote.modelId)
            ? normalizeMiniMaxH3Quality(
                body.resolution || catalog?.resolutionDefault || "768p",
              )
            : quote.modelId === KLING_OMNI_MODEL_ID
              ? normalizeKlingOmniQuality(
                  body.resolution || catalog?.resolutionDefault || "720p",
                )
              : quote.modelId === FLUX_VIDEO_MODEL_ID
                ? normalizeFluxVideoQuality(
                    body.resolution || catalog?.resolutionDefault || "HD",
                  )
                : normalizeVideoResolution(
              body.resolution || catalog?.resolutionDefault || "720p",
            );
      const bounds = durationBoundsForModel(catalog);
      const requestedDuration = body.duration ?? bounds.max;
      const isPixVerse = isPixVerseModel(quote.modelId, quote.mcpModel);
      const durationCap = isPixVerse ? pixverseDurationMax() : bounds.max;
      const modelDuration = freeTrial
        ? FREE_VERONIX_MODEL_DURATION_SECONDS
        : Math.min(durationCap, Math.max(bounds.min, requestedDuration));

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
        generateAudio:
          freeTrial && usesMiniMaxVideoBackend(quote.modelId)
            ? false
            : freeTrial
              ? true
              : Boolean(body.generateAudio),
      });

      try {
        if (isPixVerse) {
          if (body.sequencePart) {
            throw new Error("PixVerse لا يدعم لقطات Multi-shot حالياً.");
          }

          const pixQuality = normalizePixVerseQuality(
            body.resolution || catalog?.resolutionDefault || "720p",
          );
          if (asset.resolution !== pixQuality) {
            await updateAsset(asset.id, user.id, { resolution: pixQuality });
          }

          const videoRefList = (
            Array.isArray(body.referenceVideos) ? body.referenceVideos : []
          )
            .filter((r): r is VisualReference => Boolean(r?.url))
            .slice(0, 2);
          const charRefList = (
            Array.isArray(body.referenceImages) ? body.referenceImages : []
          ).filter((r): r is VisualReference => Boolean(r?.url));

          if (
            needsPixVerseExtend({
              duration: modelDuration,
              hasVideoReferences: videoRefList.length > 0,
            })
          ) {
            const parts = splitPixVerseDuration(modelDuration);
            const part1Sec = parts[0]!;
            const part2Sec = parts[1] ?? PIXVERSE_NATIVE_MAX_DURATION;
            if (parts.length < 2) {
              throw new Error("PixVerse extend split failed");
            }
            console.info("[veronix] pixverse-extend start", {
              assetId: asset.id,
              requested: body.duration,
              modelDuration,
              partDurations: [part1Sec, part2Sec],
            });
            const startResolved = await ensurePlainRefUrl(body.startFrame);
            const created = await startPixVerseClip({
              prompt: cleanPrompt,
              duration: part1Sec,
              quality: pixQuality,
              aspectRatio: body.aspectRatio,
              generateAudio: Boolean(body.generateAudio),
              startFrameUrl: startResolved || body.startFrame?.url,
              characterRefs: charRefList,
            });
            const historyId = toPixVerseHistoryId(created.videoId);
            const jobMeta: PixVerseExtendJobMeta = {
              kind: "pixverse-extend",
              prompt: cleanPrompt,
              quality: pixQuality,
              aspectRatio: body.aspectRatio,
              generateAudio: Boolean(body.generateAudio),
              durationSec: modelDuration,
              partDurations: [part1Sec, part2Sec],
              stage: "part1",
              part1VideoId: created.videoId,
              startFrameUrl: startResolved || body.startFrame?.url || null,
            };
            await updateAsset(asset.id, user.id, {
              historyId,
              url: "",
              status: "running",
              hidden: false,
              referenceImages: savedRefs,
              jobMeta,
              mode: PIXVERSE_EXTEND_MODE,
              targetSeconds: modelDuration,
            });
            after(() => {
              ensurePixVerseExtendBackground(user.id, asset.id);
            });
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
              tool: "pixverse_video_extend",
              extend: true,
              targetSeconds: modelDuration,
              quote,
            });
            continue;
          }

          const buildFusionImages = async (
            refs: VisualReference[],
          ): Promise<PixVerseFusionImageRef[]> => {
            const fusionImages: PixVerseFusionImageRef[] = [];
            for (let i = 0; i < Math.min(refs.length, 10); i++) {
              const r = refs[i]!;
              const resolved = await ensurePlainRefUrl(r);
              const imgId = await uploadPixVerseImage(r, resolved);
              const rawName =
                r.label?.trim().replace(/^@+/, "") || `ref${i + 1}`;
              fusionImages.push({
                type: "subject",
                img_id: imgId,
                ref_name: rawName.slice(0, 24),
              });
            }
            return fusionImages;
          };

          let created: { videoId: number };

          if (videoRefList.length > 0) {
            const mediaIds: number[] = [];
            for (const vref of videoRefList) {
              // Prefer original local /generations path — do not run image compressors on video.
              const localUrl = vref.url?.trim() || "";
              const resolved = localUrl.startsWith("/generations/")
                ? localUrl
                : (await ensurePlainRefUrl(vref)) || localUrl;
              mediaIds.push(await uploadPixVerseVideo(vref, resolved));
            }

            const fusionImages = await buildFusionImages(charRefList);

            created = await createPixVerseFusionTask({
              prompt: cleanPrompt,
              quality: pixQuality,
              aspectRatio: body.aspectRatio || "auto",
              generateAudio: Boolean(body.generateAudio),
              videoMediaIds: mediaIds,
              imageReferences: fusionImages.length ? fusionImages : undefined,
            });
          } else if (charRefList.length > 0) {
            const fusionImages = await buildFusionImages(charRefList);
            created = await createPixVerseFusionTask({
              prompt: cleanPrompt,
              quality: pixQuality,
              aspectRatio: body.aspectRatio,
              generateAudio: Boolean(body.generateAudio),
              imageReferences: fusionImages,
              duration: modelDuration,
            });
          } else {
            let imgId: number | undefined;
            const startResolved = await ensurePlainRefUrl(body.startFrame);
            if (body.startFrame?.url || startResolved) {
              imgId = await uploadPixVerseImage(body.startFrame, startResolved);
            }

            created = await createPixVerseVideoTask({
              prompt: cleanPrompt,
              duration: modelDuration,
              quality: pixQuality,
              aspectRatio: body.aspectRatio,
              generateAudio: Boolean(body.generateAudio),
              imgId,
            });
          }

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

        if (quote.modelId === GEMINI_OMNI_FLASH_MODEL_ID) {
          if (body.sequencePart) {
            throw new Error("Gemini Omni Flash لا يدعم لقطات Multi-shot حالياً.");
          }

          const geminiDuration = clampGeminiVideoDuration(modelDuration);
          const refList = (
            Array.isArray(body.referenceImages) ? body.referenceImages : []
          ).filter((r): r is VisualReference => Boolean(r?.url));

          const created = await createGeminiVideoInteraction({
            prompt: cleanPrompt,
            durationSec: geminiDuration,
            aspectRatio: body.aspectRatio,
            startFrame: body.startFrame,
            endFrame: body.endFrame,
            referenceImages: refList,
          });

          const historyId = toGeminiHistoryId(created.interactionId);
          await updateAsset(asset.id, user.id, {
            historyId,
            url: "",
            status: "running",
            hidden: false,
            referenceImages: savedRefs,
            targetSeconds: geminiDuration,
          });

          const runGeminiJob = async () => {
            await finalizeGeminiVideoJob({
              interactionId: created.interactionId,
              historyId,
              assetId: asset.id,
              userId: user.id,
            });
          };

          if (body.waitForResult === true) {
            await runGeminiJob();
            const fresh = await findAssetById(user.id, asset.id);
            if (fresh?.status === "completed" && fresh.url) {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "completed",
                urls: [fresh.url],
                creditsUsed: quote.totalCredits,
                freeTrial: false,
                live: true,
                provider: "gemini",
                tool: "gemini_omni_flash_video",
                quote,
              });
            } else {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "failed",
                urls: [] as string[],
                error: fresh?.error || "فشل توليد Gemini",
                creditsUsed: 0,
                freeTrial: false,
                provider: "gemini",
                tool: "gemini_omni_flash_video",
                quote,
              });
            }
            continue;
          }

          after(() => {
            void runGeminiJob();
          });

          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "running",
            urls: [] as string[],
            creditsUsed: quote.totalCredits,
            freeTrial: false,
            live: true,
            provider: "gemini",
            tool: "gemini_omni_flash_video",
            quote,
          });
          continue;
        }

        if (usesMiniMaxVideoBackend(quote.modelId)) {
          if (body.sequencePart) {
            throw new Error("MiniMax H3 لا يدعم لقطات Multi-shot حالياً.");
          }

          const miniMaxDuration = clampMiniMaxH3Duration(modelDuration);
          const miniMaxQuality = normalizeMiniMaxH3Quality(
            body.resolution || catalog?.resolutionDefault || "768p",
          );
          if (asset.resolution !== miniMaxQuality) {
            await updateAsset(asset.id, user.id, { resolution: miniMaxQuality });
          }

          const refList = (
            Array.isArray(body.referenceImages) ? body.referenceImages : []
          ).filter((r): r is VisualReference => Boolean(r?.url));

          const created = await createMiniMaxVideoTask({
            prompt: cleanPrompt,
            durationSec: miniMaxDuration,
            resolution: miniMaxQuality,
            aspectRatio: body.aspectRatio,
            startFrame: body.startFrame,
            endFrame: body.endFrame,
            referenceImages: refList,
          });

          const historyId = toMiniMaxHistoryId(created.taskId);
          await updateAsset(asset.id, user.id, {
            historyId,
            url: "",
            status: "running",
            hidden: false,
            referenceImages: savedRefs,
            targetSeconds: miniMaxDuration,
          });

          const runMiniMaxJob = async () => {
            await finalizeMiniMaxVideoJob({
              taskId: created.taskId,
              historyId,
              assetId: asset.id,
              userId: user.id,
            });
          };

          if (body.waitForResult === true) {
            await runMiniMaxJob();
            const fresh = await findAssetById(user.id, asset.id);
            if (fresh?.status === "completed" && fresh.url) {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "completed",
                urls: [fresh.url],
                creditsUsed: quote.totalCredits,
                freeTrial,
                needsBrandOutro: freeTrial && quote.modelId === VERONIX_MODEL_ID,
                live: true,
                provider: "minimax",
                tool: "minimax_h3_video",
                quote,
              });
            } else {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "failed",
                urls: [] as string[],
                error: fresh?.error || "فشل توليد MiniMax H3",
                creditsUsed: 0,
                freeTrial: false,
                provider: "minimax",
                tool: "minimax_h3_video",
                quote,
              });
            }
            continue;
          }

          after(() => {
            void runMiniMaxJob();
          });

          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "running",
            urls: [] as string[],
            creditsUsed: quote.totalCredits,
            freeTrial,
            needsBrandOutro: freeTrial && quote.modelId === VERONIX_MODEL_ID,
            live: true,
            provider: "minimax",
            tool: "minimax_h3_video",
            quote,
          });
          continue;
        }

        if (quote.modelId === KLING_OMNI_MODEL_ID) {
          if (body.sequencePart) {
            throw new Error("Kling 3.0 Omni لا يدعم لقطات Multi-shot حالياً.");
          }

          const klingDuration = clampKlingOmniDuration(modelDuration);
          const klingQuality = normalizeKlingOmniQuality(
            body.resolution || catalog?.resolutionDefault || "720p",
          );
          if (asset.resolution !== klingQuality) {
            await updateAsset(asset.id, user.id, { resolution: klingQuality });
          }

          const refList = (
            Array.isArray(body.referenceImages) ? body.referenceImages : []
          ).filter((r): r is VisualReference => Boolean(r?.url));

          const created = await createKlingOmniVideoTask({
            prompt: cleanPrompt,
            durationSec: klingDuration,
            resolution: klingQuality,
            aspectRatio: body.aspectRatio,
            generateAudio: Boolean(body.generateAudio),
            startFrame: body.startFrame,
            endFrame: body.endFrame,
            referenceImages: refList,
          });

          const historyId = toKlingHistoryId(created.taskId);
          await updateAsset(asset.id, user.id, {
            historyId,
            url: "",
            status: "running",
            hidden: false,
            referenceImages: savedRefs,
            targetSeconds: klingDuration,
          });

          const runKlingJob = async () => {
            await finalizeKlingVideoJob({
              taskId: created.taskId,
              historyId,
              assetId: asset.id,
              userId: user.id,
            });
          };

          if (body.waitForResult === true) {
            await runKlingJob();
            const fresh = await findAssetById(user.id, asset.id);
            if (fresh?.status === "completed" && fresh.url) {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "completed",
                urls: [fresh.url],
                creditsUsed: quote.totalCredits,
                freeTrial: false,
                live: true,
                provider: "kling",
                tool: "kling_3_omni_video",
                quote,
              });
            } else {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "failed",
                urls: [] as string[],
                error: fresh?.error || "فشل توليد Kling 3.0 Omni",
                creditsUsed: 0,
                freeTrial: false,
                provider: "kling",
                tool: "kling_3_omni_video",
                quote,
              });
            }
            continue;
          }

          after(() => {
            void runKlingJob();
          });

          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "running",
            urls: [] as string[],
            creditsUsed: quote.totalCredits,
            freeTrial: false,
            live: true,
            provider: "kling",
            tool: "kling_3_omni_video",
            quote,
          });
          continue;
        }

        if (quote.modelId === FLUX_VIDEO_MODEL_ID) {
          if (body.sequencePart) {
            throw new Error("FLUX 3 لا يدعم لقطات Multi-shot حالياً.");
          }

          const fluxDuration = clampFluxVideoDuration(modelDuration);
          const fluxQuality = normalizeFluxVideoQuality(
            body.resolution || catalog?.resolutionDefault || "HD",
          );
          if (asset.resolution !== fluxQuality) {
            await updateAsset(asset.id, user.id, { resolution: fluxQuality });
          }

          const refList = (
            Array.isArray(body.referenceImages) ? body.referenceImages : []
          ).filter((r): r is VisualReference => Boolean(r?.url));
          const videoList = (
            Array.isArray(body.referenceVideos) ? body.referenceVideos : []
          ).filter((r): r is VisualReference => Boolean(r?.url));

          const created = await createFluxVideoTask({
            prompt: cleanPrompt,
            durationSec: fluxDuration,
            resolution: fluxQuality,
            aspectRatio: body.aspectRatio,
            startFrame: body.startFrame,
            endFrame: body.endFrame,
            referenceImages: refList,
            referenceVideos: videoList,
          });

          const historyId = toFluxHistoryId(created.taskId);
          await updateAsset(asset.id, user.id, {
            historyId,
            url: "",
            status: "running",
            hidden: false,
            referenceImages: savedRefs,
            targetSeconds: fluxDuration,
          });

          const runFluxJob = async () => {
            await finalizeFluxVideoJob({
              taskId: created.taskId,
              historyId,
              assetId: asset.id,
              userId: user.id,
            });
          };

          if (body.waitForResult === true) {
            await runFluxJob();
            const fresh = await findAssetById(user.id, asset.id);
            if (fresh?.status === "completed" && fresh.url) {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "completed",
                urls: [fresh.url],
                creditsUsed: quote.totalCredits,
                freeTrial: false,
                live: true,
                provider: "bfl",
                tool: "flux_3_video",
                quote,
              });
            } else {
              results.push({
                assetId: asset.id,
                modelId: quote.modelId,
                historyId,
                status: "failed",
                urls: [] as string[],
                error: fresh?.error || "فشل توليد FLUX 3",
                creditsUsed: 0,
                freeTrial: false,
                provider: "bfl",
                tool: "flux_3_video",
                quote,
              });
            }
            continue;
          }

          after(() => {
            void runFluxJob();
          });

          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "running",
            urls: [] as string[],
            creditsUsed: quote.totalCredits,
            freeTrial: false,
            live: true,
            provider: "bfl",
            tool: "flux_3_video",
            quote,
          });
          continue;
        }

        const refList = (
          Array.isArray(body.referenceImages) ? body.referenceImages : []
        ).filter((r): r is VisualReference => Boolean(r?.url));
        const isSeedance2 = quote.modelId === SEEDANCE_2_MODEL_ID;

        if (isSeedance2) {
          const imageRefUrls: string[] = [];
          for (const r of refList.slice(0, 4)) {
            const u = await ensurePlainRefUrl(r);
            if (u) imageRefUrls.push(u);
          }
          const videoRefUrls: string[] = [];
          for (const r of (
            Array.isArray(body.referenceVideos) ? body.referenceVideos : []
          ).slice(0, 2)) {
            const u = await ensureBytePlusPublicMediaUrl(r.url);
            if (u) videoRefUrls.push(u);
          }
          const audioRefUrls: string[] = [];
          for (const r of (
            Array.isArray(body.referenceAudios) ? body.referenceAudios : []
          ).slice(0, 2)) {
            const u = await ensureBytePlusPublicMediaUrl(r.url);
            if (u) audioRefUrls.push(u);
          }

          let startUrl = await ensurePlainRefUrl(body.startFrame);
          let lastUrl = await ensurePlainRefUrl(body.endFrame);
          if (imageRefUrls.length || videoRefUrls.length || audioRefUrls.length) {
            startUrl = null;
            lastUrl = null;
          }

          const videoRatio = normalizeVideoRatio(body.aspectRatio);
          if (asset.aspectRatio !== videoRatio) {
            await updateAsset(asset.id, user.id, { aspectRatio: videoRatio });
          }

          const createInput = {
            catalogModelId: SEEDANCE_2_MODEL_ID,
            prompt: cleanPrompt,
            duration: modelDuration,
            ratio: videoRatio,
            generateAudio: Boolean(body.generateAudio),
            watermark: false,
            startFrameUrl: startUrl,
            lastFrameUrl: lastUrl,
            referenceImageUrls: imageRefUrls,
            referenceVideoUrls: videoRefUrls,
            referenceAudioUrls: audioRefUrls,
            multimodalRefs:
              imageRefUrls.length > 0 ||
              videoRefUrls.length > 0 ||
              audioRefUrls.length > 0,
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
              provider: "byteplus",
              tool: "byteplus_contents_generations",
              quote,
            });
            continue;
          }

          const waitMs = body.waitForResult === true ? 240_000 : 90_000;
          const finished = await waitForBytePlusVideoTask(created.id, {
            timeoutMs: body.sequencePart ? Math.min(waitMs, 90_000) : waitMs,
            intervalMs: 4_000,
            retryInput: createInput,
            catalogModelId: SEEDANCE_2_MODEL_ID,
          });
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
              freeTrial: false,
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
                      (finished.error as { message?: string }).message ||
                        (finished.error as { code?: string }).code ||
                        "",
                    )
                  : "";
            const failMsg = rawErr
              ? translateBytePlusError(rawErr)
              : "فشل توليد Seedance 2.0";
            await updateAsset(asset.id, user.id, {
              status: "failed",
              error: failMsg,
              hidden: Boolean(body.sequencePart),
            });
            await refundFailedAssetCredits({
              userId: user.id,
              assetId: asset.id,
              errorMessage: failMsg,
            });
            results.push({
              assetId: asset.id,
              modelId: quote.modelId,
              historyId,
              status: "failed",
              urls: [] as string[],
              error: failMsg,
              creditsUsed: 0,
              freeTrial: false,
              provider: "byteplus",
              tool: "byteplus_contents_generations",
              quote,
            });
            continue;
          }

          results.push({
            assetId: asset.id,
            modelId: quote.modelId,
            historyId,
            status: "running",
            urls: [] as string[],
            creditsUsed: quote.totalCredits,
            freeTrial: false,
            live: true,
            provider: "byteplus",
            tool: "byteplus_contents_generations",
            quote,
          });
          continue;
        }

        if (quote.modelId !== SEEDANCE_MINI_MODEL_ID) {
          throw new Error(`الموديل ${quote.modelId} غير مدعوم على مزود BytePlus.`);
        }

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
          catalogModelId: quote.modelId,
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
          catalogModelId: quote.modelId,
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
        const raw = err instanceof Error ? err.message : "generation failed";
        const message = isPixVerse
          ? translatePixVerseError(raw)
          : translateBytePlusError(raw);
        const provider = isPixVerse ? "pixverse" : "byteplus";
        console.error(`[veronix] ${provider} generation failed:`, raw);
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
            provider,
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
            provider,
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
