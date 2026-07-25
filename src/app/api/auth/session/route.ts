import { NextResponse } from "next/server";
import { getOpenArtMcpEndpoint } from "@/lib/openart-mcp";
import { getEnvAccessToken, hasOwnerCredentials, loadOwnerAuthSession } from "@/lib/owner-credentials";

export const runtime = "nodejs";

/**
 * Platform connection status (owner account behind the scenes).
 * Customers are never asked to log in.
 */
export async function GET() {
  const envToken = Boolean(getEnvAccessToken());
  const ownerSession = await loadOwnerAuthSession();
  const ownerOAuth = Boolean(ownerSession.tokens?.access_token);
  const connected = await hasOwnerCredentials();

  return NextResponse.json({
    // Customers always "authenticated" from UX perspective when platform is connected.
    platformConnected: connected,
    authenticated: connected,
    authMethod: envToken ? "env" : ownerOAuth ? "owner-oauth" : null,
    needsAuth: false,
    needsOwnerSetup: !connected,
    customerLoginRequired: false,
    mcpEndpoint: getOpenArtMcpEndpoint(),
    billing: "owner_account",
  });
}
