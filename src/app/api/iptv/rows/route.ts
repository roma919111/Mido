import { NextResponse } from "next/server";
import {
  getIptvSession,
  listIptvCategories,
  proxyChannelUrl,
  queryIptvChannels,
} from "@/lib/iptv-session-cache";

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

function categoryPriority(name: string): number {
  const n = name.toUpperCase();
  if (n.includes("LIVE") || n.includes("مباشر")) return 0;
  if (n.includes("SPORT") || n.includes("BEIN") || n.includes("رياض")) return 1;
  if (n.includes("MBC") || n.includes("OSN")) return 2;
  if (n.includes("NEWS") || n.includes("أخبار")) return 3;
  return 10;
}

/** Horizontal rows for Live home — a few channels per category. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const rowLimit = Math.min(12, Number(url.searchParams.get("rows") ?? "8"));
  const perCategory = Math.min(20, Number(url.searchParams.get("perCategory") ?? "12"));

  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400, headers: corsHeaders() });
  }

  const session = getIptvSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expired — login again" }, { status: 401, headers: corsHeaders() });
  }

  const categories = listIptvCategories(session.channels)
    .sort((a, b) => {
      const pa = categoryPriority(a.name);
      const pb = categoryPriority(b.name);
      if (pa !== pb) return pa - pb;
      return b.count - a.count;
    })
    .slice(0, rowLimit);

  const rows = categories.map((cat) => {
    const page = queryIptvChannels(session.channels, {
      categoryId: cat.id,
      offset: 0,
      limit: perCategory,
    });
    return {
      id: cat.id,
      title: cat.name,
      channels: page.items.map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        logo: c.logo,
        url: proxyChannelUrl(session.origin, c.id, c.url),
      })),
    };
  });

  return NextResponse.json({ rows }, { headers: corsHeaders() });
}
