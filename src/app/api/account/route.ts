import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export async function GET() {
  try {
    const result = await callOpenArtTool("openart_account_get");
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        {
          configured: false,
          credits: 0,
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          error: payload.rawText ?? "Failed to load OpenArt account",
          details: payload,
          raw: result,
        },
        { status: 502 },
      );
    }

    const user = (payload.user as Record<string, unknown> | undefined) ?? payload;
    const credits =
      typeof payload.credits === "number"
        ? payload.credits
        : typeof user.credits === "number"
          ? user.credits
          : 0;

    return NextResponse.json({
      configured: true,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      credits,
      plan: (payload.plan as string | undefined) ?? (user.plan as string | undefined) ?? "Free",
      email: (user.email as string | undefined) ?? (payload.email as string | undefined),
      details: payload,
      raw: result,
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        {
          configured: false,
          credits: 0,
          live: false,
          mcpEndpoint: MCP_ENDPOINT,
          error: error.message,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        configured: false,
        credits: 0,
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        error: error instanceof Error ? error.message : "Account lookup failed",
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { error },
      },
      { status: 500 },
    );
  }
}
