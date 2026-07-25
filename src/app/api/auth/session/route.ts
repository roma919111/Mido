import { NextResponse } from "next/server";
import { hasUsableAccessToken, loadAuthSession } from "@/lib/auth-session";
import { getEnvAccessToken, getOpenArtMcpEndpoint } from "@/lib/openart-mcp";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadAuthSession();
  const oauthConnected = hasUsableAccessToken(session);
  const envFallback = Boolean(getEnvAccessToken());

  return NextResponse.json({
    authenticated: oauthConnected || envFallback,
    authMethod: oauthConnected ? "oauth" : envFallback ? "env" : null,
    needsAuth: !oauthConnected && !envFallback,
    hasRefreshToken: Boolean(session.tokens?.refresh_token),
    clientId: session.clientInformation?.client_id ?? null,
    mcpEndpoint: getOpenArtMcpEndpoint(),
  });
}
