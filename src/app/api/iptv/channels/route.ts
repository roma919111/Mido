import { NextResponse } from "next/server";
import { getIptvSession, proxyChannelUrl, queryIptvChannels } from "@/lib/iptv-session-cache";

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

/** Paginated channel list for an IPTV session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const categoryId = url.searchParams.get("category");
  const search = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "60");

  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400, headers: corsHeaders() });
  }

  const session = getIptvSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expired — login again" }, { status: 401, headers: corsHeaders() });
  }

  const page = queryIptvChannels(session.channels, {
    categoryId,
    search,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : 60,
  });

  return NextResponse.json(
    {
      channels: page.items.map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        logo: c.logo,
        url: proxyChannelUrl(session.origin, c.id, c.url),
      })),
      total: page.total,
      hasMore: page.hasMore,
      offset: Number.isFinite(offset) ? offset : 0,
    },
    { headers: corsHeaders() },
  );
}
