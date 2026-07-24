import { NextResponse } from "next/server";
import { DEFAULT_DEMO_CREDITS } from "@/lib/models";
import {
  callOpenArtTool,
  isOpenArtConfigured,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

export async function GET() {
  if (!isOpenArtConfigured()) {
    return NextResponse.json({
      configured: false,
      credits: DEFAULT_DEMO_CREDITS,
      plan: "Demo",
      email: undefined,
      message:
        "Set OPENART_ACCESS_TOKEN to connect your OpenArt account. Showing 10 free demo credits until then.",
    });
  }

  try {
    const result = await callOpenArtTool("openart_account_get");
    if (result.isError) {
      const payload = parseToolPayload(result);
      return NextResponse.json(
        {
          configured: true,
          error: payload.rawText ?? "Failed to load OpenArt account",
        },
        { status: 502 },
      );
    }

    const payload = parseToolPayload(result);
    const user = (payload.user as Record<string, unknown> | undefined) ?? payload;
    const credits =
      typeof payload.credits === "number"
        ? payload.credits
        : typeof user.credits === "number"
          ? user.credits
          : 0;

    return NextResponse.json({
      configured: true,
      credits,
      plan: (payload.plan as string | undefined) ?? (user.plan as string | undefined) ?? "Free",
      email: (user.email as string | undefined) ?? (payload.email as string | undefined),
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        { configured: false, credits: DEFAULT_DEMO_CREDITS, error: error.message },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        configured: true,
        error: error instanceof Error ? error.message : "Account lookup failed",
      },
      { status: 500 },
    );
  }
}
