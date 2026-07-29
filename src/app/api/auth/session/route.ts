import { NextResponse } from "next/server";
import { isBytePlusConfigured, getBytePlusBaseUrl } from "@/lib/byteplus-ark";

export const runtime = "nodejs";

/**
 * Platform connection status — BytePlus ModelArk only.
 */
export async function GET() {
  const connected = isBytePlusConfigured();

  return NextResponse.json({
    platformConnected: connected,
    authenticated: connected,
    authMethod: connected ? "byteplus" : null,
    needsAuth: false,
    needsOwnerSetup: !connected,
    customerLoginRequired: false,
    provider: connected ? "byteplus" : "unconfigured",
    arkBaseUrl: connected ? getBytePlusBaseUrl() : null,
    mcpEndpoint: null,
    billing: "customer_wallet",
  });
}
