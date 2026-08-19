import { NextResponse } from "next/server";
import { getIptvSession, proxyChannelUrl } from "@/lib/iptv-session-cache";
import { resolveSeriesPlayUrl } from "@/lib/xtream-url";

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

/** Resolve series → first episode play URL. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const seriesId = Number(url.searchParams.get("seriesId"));

  const episodeId = url.searchParams.get("episodeId")?.trim() || undefined;

  if (!sessionId || !Number.isFinite(seriesId) || seriesId <= 0) {
    return NextResponse.json({ error: "session and seriesId required" }, { status: 400, headers: corsHeaders() });
  }

  const session = getIptvSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401, headers: corsHeaders() });
  }

  try {
    const resolved = await resolveSeriesPlayUrl(session.creds, seriesId, episodeId);
    if (!resolved) {
      return NextResponse.json({ error: "No episodes found" }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json(
      {
        title: resolved.title,
        url: proxyChannelUrl(session.origin, `series-ep-${episodeId ?? seriesId}`, resolved.url),
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Series error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
