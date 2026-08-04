import { NextResponse } from "next/server";
import {
  buildGenerationParams,
  resolveVideoResolution,
  VIDEO_MODEL,
} from "@/lib/models";
import {
  calculateImageCredits,
  calculateVideoCredits,
} from "@/lib/credit-pricing";
import { checkSufficientCredits, INSUFFICIENT_CREDITS_MESSAGE } from "@/lib/credits";
import {
  callOpenArtTool,
  collectMediaUrls,
  getHistoryId,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { GenerateRequest, VideoDuration } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

async function waitForCreation(historyId: string, attempts = 4) {
  let lastPayload: Record<string, unknown> = {};
  let lastRaw: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    const waitResult = await callOpenArtTool("openart_creation_wait", {
      historyId,
      timeoutSeconds: 45,
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

    if (status === "STILL_RUNNING" || status === "PENDING" || status === "RUNNING") {
      continue;
    }

    const urls = collectMediaUrls(lastPayload);
    if (urls.length > 0) {
      return { status: "COMPLETED", payload: lastPayload, raw: lastRaw };
    }
  }

  return { status: "STILL_RUNNING", payload: lastPayload, raw: lastRaw };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const mode = body.mode;
    const prompt = body.prompt?.trim();
    const duration = (body.duration ?? 5) as VideoDuration;
    const resolution = resolveVideoResolution(body);
    const generateAudio = Boolean(body.generateAudio);
    const waitForResult = body.waitForResult !== false;

    if (!mode || !prompt) {
      return NextResponse.json({ error: "mode and prompt are required" }, { status: 400 });
    }

    if (mode === "image-to-video" && !body.startFrame) {
      return NextResponse.json(
        { error: "Start frame image is required for Image-to-Video" },
        { status: 400 },
      );
    }

    const creditsUsed =
      mode === "text-to-image"
        ? calculateImageCredits()
        : calculateVideoCredits({
            model: VIDEO_MODEL,
            resolution,
            hasAudio: generateAudio,
            durationInSeconds: duration,
          });

    const balanceCheck = await checkSufficientCredits(creditsUsed);
    if (!balanceCheck.ok) {
      return NextResponse.json(
        {
          error: INSUFFICIENT_CREDITS_MESSAGE,
          balance: balanceCheck.balance,
          requiredCredits: balanceCheck.required,
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
        },
        { status: 402 },
      );
    }

    const { model, toolMode, media, params } = buildGenerationParams({
      mode,
      prompt,
      duration,
      resolution,
      generateAudio,
      startFrame: body.startFrame,
      referenceImage: body.referenceImage,
    });

    const toolName =
      media === "image" ? "openart_generate_image" : "openart_generate_video";

    const generateResult = await callOpenArtTool(toolName, {
      model,
      mode: toolMode,
      params,
    });

    const generatePayload = parseToolPayload(generateResult);
    if (generateResult.isError) {
      return NextResponse.json(
        {
          error: generatePayload.rawText ?? "OpenArt generation failed",
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          tool: toolName,
          details: generatePayload,
          raw: generateResult,
        },
        { status: 502 },
      );
    }

    const historyId = getHistoryId(generatePayload);
    if (!historyId) {
      return NextResponse.json(
        {
          error: "Generation started but no historyId was returned",
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          tool: toolName,
          details: generatePayload,
          raw: generateResult,
        },
        { status: 502 },
      );
    }

    // Credits are deducted on the OpenArt platform account when dispatch succeeds.
    const balanceAfterDispatch = balanceCheck.balance - creditsUsed;

    if (!waitForResult) {
      return NextResponse.json({
        historyId,
        status: String(generatePayload.status ?? "PENDING"),
        mediaType: media,
        mode,
        prompt,
        creditsUsed,
        balance: balanceAfterDispatch,
        requiredCredits: creditsUsed,
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        tool: toolName,
        details: generatePayload,
        raw: generateResult,
        pollAfterSeconds:
          typeof generatePayload.pollAfterSeconds === "number"
            ? generatePayload.pollAfterSeconds
            : 3,
      });
    }

    const waited = await waitForCreation(historyId);
    const urls = collectMediaUrls(waited.payload);

    return NextResponse.json({
      historyId,
      status: waited.status,
      mediaType: media,
      mode,
      prompt,
      creditsUsed,
      balance: balanceAfterDispatch,
      requiredCredits: creditsUsed,
      urls,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      tool: toolName,
      error:
        waited.status === "FAILED"
          ? String(waited.payload.error ?? waited.payload.message ?? "Generation failed")
          : undefined,
      details: {
        generate: generatePayload,
        wait: waited.payload,
      },
      raw: {
        generate: generateResult,
        wait: waited.raw,
      },
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          live: false,
          needsAuth: error.needsAuth,
          mcpEndpoint: MCP_ENDPOINT,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generation failed",
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { error },
      },
      { status: 500 },
    );
  }
}
