import { NextResponse } from "next/server";
import { isBytePlusConfigured, getBytePlusBaseUrl } from "@/lib/byteplus-ark";
import { getCurrentUser } from "@/lib/customer-auth";

export const runtime = "nodejs";

/**
 * Platform readiness for the studio.
 * Generation runs on BytePlus — no OpenArt account lookup.
 */
export async function GET() {
  const configured = isBytePlusConfigured();
  const user = await getCurrentUser();

  return NextResponse.json({
    configured,
    live: configured,
    needsAuth: false,
    needsOwnerSetup: !configured,
    customerLoginRequired: false,
    billing: "customer_wallet",
    provider: configured ? "byteplus" : "unconfigured",
    mcpEndpoint: null,
    credits: user?.credits ?? 0,
    plan: user?.planId || "Free",
    email: user?.email || "VYRONIX.AI Studio",
    arkBaseUrl: configured ? getBytePlusBaseUrl() : undefined,
    details: {
      plan: user?.planId || "Free",
      credits: user?.credits ?? 0,
      provider: configured ? "byteplus" : "unconfigured",
    },
    raw: { status: configured ? "ok" : "byteplus_unconfigured" },
  });
}
