import { NextResponse } from "next/server";
import { getIptvSession } from "@/lib/iptv-session-cache";

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

/** Keep the IPTV session alive while the customer stays on the app. */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400, headers: corsHeaders() });
  }
  const session = getIptvSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, expired: true, error: "Session expired" }, { status: 401, headers: corsHeaders() });
  }
  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
