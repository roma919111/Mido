import { NextResponse } from "next/server";
import {
  hasOwnerCredentials,
  isOwnerSetupAuthorized,
  saveOwnerTokens,
} from "@/lib/owner-credentials";
import { getAppBaseUrl } from "@/lib/app-url";
import { saveCostCache } from "@/lib/openart-cost-cache";
import {
  OPENART_COST_DEFAULTS,
  type CostCacheItem,
} from "@/lib/openart-cost-defaults";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    platformConnected: await hasOwnerCredentials(),
    oauthLoginUrl: `${getAppBaseUrl()}/api/auth/login`,
    costDefaultsCount: OPENART_COST_DEFAULTS.length,
  });
}

export async function POST(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      costItems?: CostCacheItem[];
    };

    if (Array.isArray(body.costItems) && body.costItems.length) {
      await saveCostCache(body.costItems);
      return NextResponse.json({
        ok: true,
        saved: "cost-cache",
        count: body.costItems.length,
        message: "Cost cache synced.",
      });
    }

    const accessToken = body.accessToken?.trim() || "";
    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken or costItems required" },
        { status: 400 },
      );
    }

    await saveOwnerTokens({
      access_token: accessToken,
      refresh_token: body.refreshToken?.trim() || undefined,
      token_type: "bearer",
      expires_in: body.expiresIn,
      obtained_at: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      saved: "owner-token",
      platformConnected: true,
      message: "Owner OpenArt token saved. Cost sync + generation can use the platform account.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 422 },
    );
  }
}
