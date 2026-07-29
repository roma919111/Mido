import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import {
  buildPricingBreakdown,
  getActivePricingConfig,
  tokenUsdPer1k,
  type VeronixPricingConfig,
} from "@/lib/byteplus-pricing";
import {
  ensurePricingConfigLoaded,
  savePricingConfig,
} from "@/lib/veronix-pricing-store";

export const runtime = "nodejs";

function payload(cfg: VeronixPricingConfig) {
  return {
    ok: true,
    config: cfg,
    tokenUsdPer1k: tokenUsdPer1k(cfg),
    rows: buildPricingBreakdown(cfg),
  };
}

export async function GET() {
  try {
    await requireAdminUser();
    const cfg = await ensurePricingConfigLoaded();
    return NextResponse.json(payload(cfg));
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin denied" },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const body = (await request.json()) as Partial<VeronixPricingConfig>;
    const cfg = await savePricingConfig(body);
    // Keep getActive in sync for this process.
    void getActivePricingConfig();
    return NextResponse.json({
      ...payload(cfg),
      saved: true,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status },
    );
  }
}
