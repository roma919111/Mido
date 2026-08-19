import { NextResponse } from "next/server";
import { buildIptvHomeDashboard } from "@/lib/iptv-home";

export const runtime = "nodejs";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Home dashboard: subscription, latest VOD, upcoming matches. */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const dashboard = await buildIptvHomeDashboard(sessionId);
    return NextResponse.json(dashboard, { headers: corsHeaders() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Home error";
    const status = msg.includes("expired") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status, headers: corsHeaders() });
  }
}
