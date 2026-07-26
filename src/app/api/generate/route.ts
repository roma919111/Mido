import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { adjustCredits, createAsset, updateAsset, updateUser } from "@/lib/db";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import {
  createBytePlusVideoTask,
  isBytePlusConfigured,
  resolvePublicMediaUrl,
  toBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import {
  FREE_VERONIX_MODEL_DURATION_SECONDS,
  FREE_VERONIX_RESOLUTION,
  isFreeVeronixEligible,
  VERONIX_MODEL_ID,
} from "@/lib/free-trial";
import {
  durationBoundsForModel,
  getCatalogModel,
  resolveMcpModel,
  setLiveCatalogCache,
} from "@/lib/model-catalog";
import { loadSyncedCatalog } from "@/lib/openart-catalog-sync";
import { audioParamForMcpModel, mapResolutionForMcpModel } from "@/lib/model-params";
import {
  callOpenArtTool,
  collectMediaUrls,
  getHistoryId,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { VisualReference } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

type GenBody = {
  modelIds?: string[];
  media?: "image" | "video";
  mode?: string;
  prompt?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  generateAudio?: boolean;
  startFrame?: VisualReference | null;
  endFrame?: VisualReference | null;
  referenceImages?: VisualReference[];
  waitForResult?: boolean;
  /** Intermediate multi-shot clip — hidden from Assets; final stitch is shown */
  sequencePart?: boolean;
};

async function waitForCreation(historyId: string, attempts = 2) {
  let lastPayload: Record<string, unknown> = {};
  let lastRaw: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    const waitResult = await callOpenArtTool("openart_creation_wait", {
      historyId,
      timeoutSeconds: 40,
    });
    lastRaw = waitResult;
    lastPayload = parseToolPayload(waitResult);
    if (waitResult.isError) {
      return { status: "FAILED", payload: lastPayload, raw: lastRaw };
    }
    const status = String(
      lastPayload.status ?? lastPayload.state ?? lastPayload.resultStatus ?? "",
    ).toUpperCase();
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) {
      return { status, payload: lastPayload, raw: lastRaw };
    }
    const urls = collectMediaUrls(lastPayload);
    if (urls.length > 0) return { status: "COMPLETED", payload: lastPayload, raw: lastRaw };
  }

  return { status: "STILL_RUNNING", payload: lastPayload, raw: lastRaw };
}

function resolveToolMode(media: "image" | "video", hasStart: boolean, hasRefs: boolean) {
  if (media === "image") return hasRefs ? "image2image" : "text2image";
  if (hasStart) return "image2video";
  return "text2video";
}

export async function POST(request: Request) {
  try {
    // Prefer last OpenArt-synced catalog so every MCP model resolves correctly.
    const synced = await loadSyncedCatalog();
    if (synced) setLiveCatalogCache({ image: synced.image, video: synced.video });

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Login required", needsAuth: true, needsPaywall: true },
        { status: 401 },
      );
    }

    const body = (await request.json()) as GenBody;
    const prompt = body.prompt?.trim();
    const requestedMedia = body.media ?? "video";
    const modelIds = [...new Set(body.modelIds?.filter(Boolean) ?? [])].slice(0, 4);
    const waitForResult = body.waitForResult === true;

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

    // Quote exact OpenArt costs for all selected models
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
          { allowCache: false },
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
      const mcpModel = catalog ? resolveMcpModel(catalog) : quote.mcpModel;
      const toolName = "openart_generate_video";

      const hasResolutionControl = Array.isArray(catalog?.resolutions)
        ? catalog.resolutions.length > 0
        : true;
      const uiResolution = freeTrial
        ? FREE_VERONIX_RESOLUTION
        : body.resolution || catalog?.resolutionDefault || "720p";
      const mappedResolution = hasResolutionControl
        ? mapResolutionForMcpModel(mcpModel, uiResolution)
        : undefined;
      // Free trial: model renders 4s; stock intro is prepended locally afterward.
      const bounds = durationBoundsForModel(catalog);
      const requestedDuration = body.duration ?? bounds.max;
      const modelDuration = freeTrial
        ? FREE_VERONIX_MODEL_DURATION_SECONDS
        : Math.min(bounds.max, Math.max(bounds.min, requestedDuration));
      const params: Record<string, unknown> = {
        prompt,
        videoCount: 1,
        duration: modelDuration,
        ...(mappedResolution ? { resolution: mappedResolution } : {}),
        // Product rule: video output is locked to 16:9.
        aspectRatio: "16:9",
        ...audioParamForMcpModel(
          mcpModel,
          freeTrial ? true : body.generateAudio,
          catalog?.audioParam,
        ),
        autoEnhancePrompt: false,
        ...(body.startFrame ? { startFrame: body.startFrame } : {}),
        ...(body.endFrame ? { endFrame: body.endFrame } : {}),
      };

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
        hidden: Boolean(body.sequencePart),
      });

      try {
        // Primary: BytePlus ModelArk for Veronix video. OpenArt kept as fallback.
        const useBytePlus =
          media === "video" &&
          quote.modelId === VERONIX_MODEL_ID &&
          isBytePlusConfigured();

        if (useBytePlus) {
          try {
            const startUrl = resolvePublicMediaUrl(body.startFrame);
            const task = await createBytePlusVideoTask({
              prompt,
              duration: modelDuration,
              ratio: "16:9",
              generateAudio: freeTrial ? true : Boolean(body.generateAudio),
              watermark: false,
              startFrameUrl: startUrl,
              resolution: uiResolution,
            });
            const historyId = toBytePlusHistoryId(task.id);
            await updateAsset(asset.id, user.id, {
              historyId,
              url: "",
              status: "running",
            });
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
          } catch (bpErr) {
            const bpMsg =
              bpErr instanceof Error ? bpErr.message : "BytePlus generation failed";
            // ModelNotOpen / misconfig → fall through to OpenArt backup.
            console.warn("[veronix] BytePlus primary failed, OpenArt fallback:", bpMsg);
          }
        }

        const generateResult = await callOpenArtTool(toolName, {
          model: mcpModel,
          mode: quote.mode,
          params,
        });
        const generatePayload = parseToolPayload(generateResult);

        if (generateResult.isError) {
          const nestedError =
            typeof generatePayload.error === "string"
              ? generatePayload.error
              : "Veronix generation failed";
          await updateAsset(asset.id, user.id, { status: "failed", error: nestedError });
          if (!freeTrial && quote.totalCredits > 0) {
            await adjustCredits(user.id, quote.totalCredits);
          }
          results.push({
            modelId: quote.modelId,
            error: nestedError,
            creditsUsed: 0,
            freeTrial,
            details: generatePayload,
          });
          continue;
        }

        const historyId = getHistoryId(generatePayload);
        let urls: string[] = collectMediaUrls(generatePayload);
        let status = String(generatePayload.status ?? "PENDING").toUpperCase();

        if (waitForResult && historyId) {
          const waited = await waitForCreation(historyId);
          urls = collectMediaUrls(waited.payload);
          status = waited.status;
        }

        const finalStatus =
          status === "FAILED"
            ? "failed"
            : urls.length || status === "COMPLETED"
              ? "completed"
              : "running";

        await updateAsset(asset.id, user.id, {
          historyId: historyId || undefined,
          url: urls[0] || "",
          status: finalStatus,
          error: finalStatus === "failed" ? String(generatePayload.error || "failed") : undefined,
          creditsUsed: finalStatus === "failed" ? 0 : quote.totalCredits,
        });

        if (finalStatus === "failed" && !freeTrial && quote.totalCredits > 0) {
          await adjustCredits(user.id, quote.totalCredits);
        }

        results.push({
          assetId: asset.id,
          modelId: quote.modelId,
          historyId,
          status: finalStatus,
          urls,
          creditsUsed: finalStatus === "failed" ? 0 : quote.totalCredits,
          freeTrial,
          needsBrandOutro: freeTrial && finalStatus !== "failed",
          live: true,
          provider: "openart",
          mcpEndpoint: MCP_ENDPOINT,
          tool: toolName,
          quote,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        await updateAsset(asset.id, user.id, { status: "failed", error: message });
        if (!freeTrial && quote.totalCredits > 0) {
          await adjustCredits(user.id, quote.totalCredits);
        }
        results.push({
          modelId: quote.modelId,
          error: message,
          creditsUsed: 0,
          freeTrial,
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
      mcpEndpoint: MCP_ENDPOINT,
      billing: freeTrial ? "free_veronix_trial" : "customer_wallet",
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          live: false,
          needsOwnerSetup: error.needsAuth,
          mcpEndpoint: MCP_ENDPOINT,
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
