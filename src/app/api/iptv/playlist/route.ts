import { NextResponse } from "next/server";
import { fetchAndParseM3u } from "@/lib/m3u-parser";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";
import { getRequestPublicOrigin } from "@/lib/request-origin";
import {
  buildM3uPlusUrl,
  fetchXtreamChannels,
  verifyXtreamLogin,
  type XtreamCredentials,
} from "@/lib/xtream-url";

export const runtime = "nodejs";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

type PlaylistBody = {
  host?: string;
  username?: string;
  password?: string;
};

function proxyChannelUrl(origin: string, id: string, upstreamUrl: string): string {
  return `${origin}/api/iptv/proxy?id=${encodeURIComponent(id)}&src=${Buffer.from(upstreamUrl, "utf8").toString("base64url")}`;
}

/** Login with Xtream host + username + password → channel list. */
export async function POST(request: Request) {
  let body: PlaylistBody;
  try {
    body = (await request.json()) as PlaylistBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  const host = body.host?.trim() ?? "";
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!host || !username || !password) {
    return NextResponse.json(
      { error: "host, username, and password are required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const creds: XtreamCredentials = { host, username, password };
  const origin = getRequestPublicOrigin(request);

  try {
    await verifyXtreamLogin(creds).catch(() => {
      /* Some providers omit player_api — continue */
    });

    let channels: { id: string; name: string; group: string | null; logo: string | null; url: string }[] = [];
    let source: "api" | "m3u" = "api";

    try {
      const apiChannels = await fetchXtreamChannels(creds);
      channels = apiChannels.map((c) => ({
        ...c,
        url: proxyChannelUrl(origin, c.id, c.url),
      }));
    } catch {
      source = "m3u";
      const m3uUrl = buildM3uPlusUrl(creds);
      assertSafeIptvUrl(m3uUrl);
      const parsed = await fetchAndParseM3u(m3uUrl);
      channels = parsed.slice(0, 8000).map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group ?? null,
        logo: c.logo ?? null,
        url: proxyChannelUrl(origin, c.id, c.url),
      }));
    }

    if (!channels.length) {
      return NextResponse.json({ error: "Playlist is empty" }, { status: 502, headers: corsHeaders() });
    }

    return NextResponse.json(
      {
        host,
        username,
        label: username,
        source,
        total: channels.length,
        channels,
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playlist error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
