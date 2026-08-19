import { NextResponse } from "next/server";
import {
  getCatalogForKind,
  mapChannelForClient,
  queryIptvChannels,
} from "@/lib/iptv-session-cache";
import type { IptvKind } from "@/lib/xtream-url";

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

function parseKind(raw: string | null): IptvKind {
  if (raw === "movie" || raw === "series") return raw;
  return "live";
}

/** Paginated list for live / movies / series. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const kind = parseKind(url.searchParams.get("type"));
  const categoryId = url.searchParams.get("category");
  const search = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "60");

  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const { session, items, categories, loading } = await getCatalogForKind(sessionId, kind, categoryId);

    if (loading) {
      return NextResponse.json(
        { loading: true, kind, channels: [], total: 0, hasMore: false, categories },
        { headers: corsHeaders() },
      );
    }

    const page = queryIptvChannels(items, {
      categoryId: kind === "live" ? categoryId : undefined,
      search,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 60,
    });

    return NextResponse.json(
      {
        kind,
        categories,
        channels: page.items.map((c) => mapChannelForClient(session, c)),
        total: page.total,
        hasMore: page.hasMore,
        offset: Number.isFinite(offset) ? offset : 0,
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    const status = msg.includes("expired") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status, headers: corsHeaders() });
  }
}
