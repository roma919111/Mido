import { NextResponse } from "next/server";
import { isBytePlusConfigured, getBytePlusBaseUrl } from "@/lib/byteplus-ark";
import { isPixVerseConfigured } from "@/lib/pixverse";
import { getCurrentUser } from "@/lib/customer-auth";

export const runtime = "nodejs";

/**
 * Platform readiness for the studio.
 * Generation runs on BytePlus — no OpenArt account lookup.
 */
export async function GET() {
  const byteplus = isBytePlusConfigured();
  const pixverse = isPixVerseConfigured();
  const configured = byteplus || pixverse;
  const user = await getCurrentUser();

  return NextResponse.json({
    configured,
    live: configured,
    needsAuth: false,
    needsOwnerSetup: !configured,
    customerLoginRequired: false,
    billing: "customer_wallet",
    provider: byteplus ? "byteplus" : pixverse ? "pixverse" : "unconfigured",
    pixverseDirect: pixverse,
    mcpEndpoint: null,
    credits: user?.credits ?? 0,
    plan: user?.planId || "Free",
    email: user?.email || "VYRONIX.AI Studio",
    arkBaseUrl: byteplus ? getBytePlusBaseUrl() : undefined,
    details: {
      plan: user?.planId || "Free",
      credits: user?.credits ?? 0,
      provider: byteplus ? "byteplus" : pixverse ? "pixverse" : "unconfigured",
      pixverseDirect: pixverse,
    },
    raw: {
      status: configured ? "ok" : "unconfigured",
    },
  });
}
