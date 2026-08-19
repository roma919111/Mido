import { NextResponse } from "next/server";
import { getIptvSession, proxyChannelUrl, proxyPosterUrl } from "@/lib/iptv-session-cache";
import { fetchXtreamSeriesDetails, fetchXtreamVodDetails } from "@/lib/xtream-url";

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

/** Movie or series details for the info page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const type = url.searchParams.get("type")?.trim() === "series" ? "series" : "movie";
  const id = Number(url.searchParams.get("id"));

  if (!sessionId || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "session and id required" }, { status: 400, headers: corsHeaders() });
  }

  const session = getIptvSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401, headers: corsHeaders() });
  }

  try {
    if (type === "movie") {
      const details = await fetchXtreamVodDetails(session.creds, id);
      return NextResponse.json(
        {
          ...details,
          cover: proxyPosterUrl(session.origin, details.cover),
          playUrl: proxyChannelUrl(session.origin, `movie-${id}`, details.playUrl),
        },
        { headers: corsHeaders() },
      );
    }

    const details = await fetchXtreamSeriesDetails(session.creds, id);
    return NextResponse.json(
      {
        ...details,
        cover: proxyPosterUrl(session.origin, details.cover),
        seasons: details.seasons.map((season) => ({
          ...season,
          episodes: season.episodes.map((ep) => ({
            ...ep,
            cover: proxyPosterUrl(session.origin, ep.cover),
            playUrl: proxyChannelUrl(session.origin, `series-ep-${ep.id}`, ep.playUrl),
          })),
        })),
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Info error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
