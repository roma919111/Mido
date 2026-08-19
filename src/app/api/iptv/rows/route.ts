import { NextResponse } from "next/server";
import {
  categoryPriority,
  getCatalogForKind,
  getIptvSession,
  mapChannelForClient,
  queryIptvChannels,
} from "@/lib/iptv-session-cache";
import type { IptvKind } from "@/lib/xtream-url";
import { fetchXtreamMoviesByCategory, fetchXtreamSeriesByCategory } from "@/lib/xtream-url";

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

/** Horizontal rows for Live / Movies / Series home screens. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const kind = parseKind(url.searchParams.get("type"));
  const rowLimit = Math.min(10, Number(url.searchParams.get("rows") ?? "8"));
  const perCategory = Math.min(16, Number(url.searchParams.get("perCategory") ?? "12"));

  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400, headers: corsHeaders() });
  }

  try {
    if (kind === "live") {
      const { session, items, loading } = await getCatalogForKind(sessionId, kind);
      if (loading) {
        return NextResponse.json({ loading: true, rows: [] }, { headers: corsHeaders() });
      }

      const categories = [...new Map(items.map((c) => [c.categoryId ?? c.group ?? "other", c.group ?? "Other"])).entries()]
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => {
          const pa = categoryPriority(a.title, kind);
          const pb = categoryPriority(b.title, kind);
          if (pa !== pb) return pa - pb;
          return a.title.localeCompare(b.title, "ar");
        })
        .slice(0, rowLimit);

      const rows = categories.map((cat) => {
        const page = queryIptvChannels(items, {
          categoryId: cat.id,
          offset: 0,
          limit: perCategory,
        });
        return {
          id: cat.id,
          title: cat.title,
          channels: page.items.map((c) => mapChannelForClient(session, c)),
        };
      });

      return NextResponse.json({ kind, rows }, { headers: corsHeaders() });
    }

    const session = getIptvSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session expired" }, { status: 401, headers: corsHeaders() });
    }

    const { categories, loading } = await getCatalogForKind(sessionId, kind);
    if (loading) {
      return NextResponse.json({ loading: true, rows: [] }, { headers: corsHeaders() });
    }

    const sorted = [...categories]
      .sort((a, b) => {
        const pa = categoryPriority(a.name, kind);
        const pb = categoryPriority(b.name, kind);
        if (pa !== pb) return pa - pb;
        return b.count - a.count;
      })
      .slice(0, rowLimit);

    const rows = [];
    for (const cat of sorted) {
      let items = kind === "movie" ? session.vodByCategory.get(cat.id) : session.seriesByCategory.get(cat.id);
      if (!items) {
        items =
          kind === "movie"
            ? await fetchXtreamMoviesByCategory(session.creds, cat.id)
            : await fetchXtreamSeriesByCategory(session.creds, cat.id);
        if (kind === "movie") session.vodByCategory.set(cat.id, items);
        else session.seriesByCategory.set(cat.id, items);
      }

      rows.push({
        id: cat.id,
        title: cat.name,
        channels: items.slice(0, perCategory).map((c) => mapChannelForClient(session, c)),
      });
    }

    return NextResponse.json({ kind, rows }, { headers: corsHeaders() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load rows";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
