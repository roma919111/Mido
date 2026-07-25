import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { adjustCredits, createAsset, updateAsset } from "@/lib/db";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import { getCatalogModel, resolveMcpModel } from "@/lib/model-catalog";
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Login required", needsAuth: true, needsPaywall: true },
        { status: 401 },
      );
    }

    const body = (await request.json()) as GenBody;
    const prompt = body.prompt?.trim();
    const media = body.media ?? "image";
    const modelIds = [...new Set(body.modelIds?.filter(Boolean) ?? [])].slice(0, 4);
    const waitForResult = body.waitForResult === true;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (!modelIds.length) {
      return NextResponse.json({ error: "Select at least one model" }, { status: 400 });
    }

    const mode =
      body.mode ||
      resolveToolMode(media, Boolean(body.startFrame), Boolean(body.referenceImages?.length));

    // Quote exact OpenArt costs for all selected models
    const quotes = [];
    for (const modelId of modelIds) {
      quotes.push(
        await quoteOpenArtCredits({
          modelId,
          media,
          mode,
          aspectRatio: body.aspectRatio,
          resolution: body.resolution,
          duration: body.duration,
          generateAudio: body.generateAudio,
        }),
      );
    }
    const totalCredits = quotes.reduce((s, q) => s + q.totalCredits, 0);

    if (user.credits < totalCredits) {
      return NextResponse.json(
        {
          error: "Not enough Veronix credits. Upgrade your plan to continue.",
          needsPaywall: true,
          credits: user.credits,
          requiredCredits: totalCredits,
          quotes,
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
          quotes,
        },
        { status: 422 },
      );
    }

    // Reserve credits up-front
    await adjustCredits(user.id, -totalCredits);

    const results = [];
    for (const quote of quotes) {
      const catalog = getCatalogModel(quote.modelId);
      const mcpModel = catalog ? resolveMcpModel(catalog) : quote.mcpModel;
      const toolName = media === "image" ? "openart_generate_image" : "openart_generate_video";

      const params: Record<string, unknown> =
        media === "image"
          ? {
              prompt,
              imageCount: 1,
              aspectRatio: body.aspectRatio ?? "1:1",
              autoEnhancePrompt: false,
              ...(body.referenceImages?.length
                ? { visualReferences: body.referenceImages }
                : {}),
            }
          : {
              prompt,
              videoCount: 1,
              duration: body.duration ?? 5,
              resolution: body.resolution ?? "720p",
              aspectRatio: body.aspectRatio ?? "16:9",
              generateAudio: Boolean(body.generateAudio),
              autoEnhancePrompt: false,
              ...(body.startFrame ? { startFrame: body.startFrame } : {}),
              ...(body.endFrame ? { endFrame: body.endFrame } : {}),
            };

      const asset = await createAsset({
        userId: user.id,
        mediaType: media,
        url: "",
        prompt,
        mode,
        model: quote.modelId,
        creditsUsed: quote.totalCredits,
        status: "running",
      });

      try {
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
          // refund this model
          await adjustCredits(user.id, quote.totalCredits);
          results.push({
            modelId: quote.modelId,
            error: nestedError,
            creditsUsed: 0,
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
        });

        if (finalStatus === "failed") {
          await adjustCredits(user.id, quote.totalCredits);
        }

        results.push({
          assetId: asset.id,
          modelId: quote.modelId,
          historyId,
          status: finalStatus,
          urls,
          creditsUsed: finalStatus === "failed" ? 0 : quote.totalCredits,
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          tool: toolName,
          quote,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        await updateAsset(asset.id, user.id, { status: "failed", error: message });
        await adjustCredits(user.id, quote.totalCredits);
        results.push({ modelId: quote.modelId, error: message, creditsUsed: 0 });
      }
    }

    const refreshed = await getCurrentUser();
    return NextResponse.json({
      results,
      totalCreditsQuoted: totalCredits,
      creditsRemaining: refreshed?.credits ?? 0,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      billing: "customer_wallet",
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
