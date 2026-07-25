import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  OpenArtConfigError,
  parseToolPayload,
  getOpenArtMcpEndpoint,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

export async function GET() {
  const mcpEndpoint = getOpenArtMcpEndpoint();

  try {
    const result = await callOpenArtTool("openart_account_get");
    const payload = parseToolPayload(result);

    if (result.isError) {
      return NextResponse.json(
        {
          configured: false,
          credits: 0,
          live: true,
          needsAuth: false,
          customerLoginRequired: false,
          billing: "owner_account",
          mcpEndpoint,
          error: payload.rawText ?? "Failed to load platform OpenArt account",
          details: payload,
          raw: result,
        },
        { status: 422 },
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
      needsAuth: false,
      customerLoginRequired: false,
      billing: "owner_account",
      mcpEndpoint,
      credits,
      plan: (payload.plan as string | undefined) ?? (user.plan as string | undefined) ?? "Free",
      // Do not expose owner email to customers — show studio label instead.
      email: "VYRONIX.AI Studio",
      details: {
        plan: (payload.plan as string | undefined) ?? (user.plan as string | undefined),
        credits,
      },
      raw: { status: "ok" },
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        {
          configured: false,
          credits: 0,
          live: false,
          needsAuth: false,
          needsOwnerSetup: error.needsAuth,
          customerLoginRequired: false,
          billing: "owner_account",
          mcpEndpoint,
          error: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        configured: false,
        credits: 0,
        live: true,
        needsAuth: false,
        customerLoginRequired: false,
        billing: "owner_account",
        mcpEndpoint,
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
