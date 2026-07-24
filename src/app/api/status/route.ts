import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  collectMediaUrls,
  isOpenArtConfigured,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get("historyId");

  if (!historyId) {
    return NextResponse.json({ error: "historyId is required" }, { status: 400 });
  }

  if (historyId.startsWith("demo_")) {
    return NextResponse.json({
      historyId,
      status: "COMPLETED",
      urls: [],
      demo: true,
    });
  }

  if (!isOpenArtConfigured()) {
    return NextResponse.json(
      { error: "OPENART_ACCESS_TOKEN is required" },
      { status: 401 },
    );
  }

  try {
    const result = await callOpenArtTool("openart_creation_get", { historyId });
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        { error: payload.rawText ?? "Failed to fetch status", historyId },
        { status: 502 },
      );
    }

    const status = String(payload.status ?? payload.state ?? "UNKNOWN").toUpperCase();
    const urls = collectMediaUrls(payload);

    return NextResponse.json({
      historyId,
      status,
      urls,
      pollAfterSeconds:
        typeof payload.pollAfterSeconds === "number" ? payload.pollAfterSeconds : undefined,
      error:
        status === "FAILED"
          ? String(payload.error ?? payload.message ?? "Generation failed")
          : undefined,
      payload,
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 },
    );
  }
}
