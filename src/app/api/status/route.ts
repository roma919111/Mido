import { NextResponse } from "next/server";
import {
  getBytePlusVideoTask,
  mapBytePlusStatus,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import { getCurrentUser } from "@/lib/customer-auth";
import { findAssetByHistoryId, updateAsset } from "@/lib/db";
import { ensureClarityUrl } from "@/lib/ensure-clarity";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get("historyId");
  const assetId = searchParams.get("assetId")?.trim() || "";

  if (!historyId) {
    return NextResponse.json({ error: "historyId is required" }, { status: 400 });
  }

  const byteplusId = parseBytePlusHistoryId(historyId);
  if (byteplusId) {
    try {
      const task = await getBytePlusVideoTask(byteplusId);
      const status = mapBytePlusStatus(task.status);
      const urls = task.content?.video_url ? [task.content.video_url] : [];
      const errMsg =
        typeof task.error === "string"
          ? task.error
          : task.error && typeof task.error === "object"
            ? String(task.error.message || task.error.code || "")
            : "";

      // Persist into Assets as soon as BytePlus has a URL.
      const user = await getCurrentUser().catch(() => null);
      if (user && (urls[0] || status === "FAILED")) {
        const byHistory = await findAssetByHistoryId(user.id, historyId);
        const targetId = assetId || byHistory?.id;
        if (targetId) {
          const existing = byHistory;
          const keepHidden = existing?.mode === "sequence-part";
          if (urls[0]) {
            const graded = keepHidden
              ? urls[0]
              : await ensureClarityUrl(urls[0]);
            await updateAsset(targetId, user.id, {
              historyId,
              url: graded,
              status: "completed",
              error: undefined,
              hidden: keepHidden ? true : false,
            }).catch(() => null);
            urls[0] = graded;
          } else if (status === "FAILED") {
            await updateAsset(targetId, user.id, {
              historyId,
              status: "failed",
              error: errMsg || "BytePlus generation failed",
              hidden: keepHidden ? true : false,
            }).catch(() => null);
          }
        }
      }

      return NextResponse.json({
        historyId,
        status,
        urls,
        live: true,
        provider: "byteplus",
        pollAfterSeconds: status === "RUNNING" || status === "PENDING" ? 8 : undefined,
        error: status === "FAILED" ? errMsg || "BytePlus generation failed" : undefined,
        details: task.raw,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "BytePlus status failed",
          historyId,
          live: true,
          provider: "byteplus",
        },
        { status: 502 },
      );
    }
  }

  try {
    const result = await callOpenArtTool("openart_creation_get", { historyId });
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        {
          error: payload.rawText ?? "Failed to fetch status",
          historyId,
          live: true,
          provider: "openart",
          mcpEndpoint: MCP_ENDPOINT,
          details: payload,
          raw: result,
        },
        { status: 422 },
      );
    }

    const status = String(payload.status ?? payload.state ?? "UNKNOWN").toUpperCase();
    const urls = collectMediaUrls(payload);

    return NextResponse.json({
      historyId,
      status,
      urls,
      live: true,
      provider: "openart",
      mcpEndpoint: MCP_ENDPOINT,
      pollAfterSeconds:
        typeof payload.pollAfterSeconds === "number" ? payload.pollAfterSeconds : undefined,
      error:
        status === "FAILED"
          ? String(payload.error ?? payload.message ?? "Generation failed")
          : undefined,
      details: payload,
      raw: result,
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
        error: error instanceof Error ? error.message : "Status check failed",
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
