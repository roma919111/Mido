import { NextResponse } from "next/server";
import {
  getActivePricingConfig,
  tokenUsdPer1k,
} from "@/lib/byteplus-pricing";
import { ensurePricingConfigLoaded } from "@/lib/veronix-pricing-store";

export const runtime = "nodejs";

/** Public rates for Create UI credit estimates. */
export async function GET() {
  try {
    const cfg = await ensurePricingConfigLoaded();
    return NextResponse.json({
      ok: true,
      config: cfg,
      tokenUsdPer1k: tokenUsdPer1k(cfg || getActivePricingConfig()),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pricing unavailable" },
      { status: 500 },
    );
  }
}
