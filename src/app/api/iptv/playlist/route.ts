import { NextResponse } from "next/server";
import { fetchAndParseM3u } from "@/lib/m3u-parser";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";
import {
  createIptvSession,
  listIptvCategories,
  proxyChannelUrl,
} from "@/lib/iptv-session-cache";
import { getRequestPublicOrigin } from "@/lib/request-origin";
import {
  buildM3uPlusUrl,
  fetchXtreamChannels,
  verifyXtreamLogin,
  type XtreamChannel,
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

async function loadRawChannels(creds: XtreamCredentials): Promise<{ channels: XtreamChannel[]; source: "api" | "m3u" }> {
  try {
    const apiChannels = await fetchXtreamChannels(creds);
    return { channels: apiChannels, source: "api" };
  } catch {
    const m3uUrl = buildM3uPlusUrl(creds);
    assertSafeIptvUrl(m3uUrl);
    const parsed = await fetchAndParseM3u(m3uUrl);
    const channels: XtreamChannel[] = parsed.slice(0, 8000).map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group ?? null,
      logo: c.logo ?? null,
      url: c.url,
    }));
    return { channels, source: "m3u" };
  }
}

/** Login → session token + categories only (channels loaded in pages). */
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
    await verifyXtreamLogin(creds).catch(() => undefined);

    const { channels, source } = await loadRawChannels(creds);
    if (!channels.length) {
      return NextResponse.json({ error: "Playlist is empty" }, { status: 502, headers: corsHeaders() });
    }

    const sessionId = createIptvSession(channels, creds, origin);
    const categories = listIptvCategories(channels);

    return NextResponse.json(
      {
        sessionId,
        host,
        username,
        label: username,
        source,
        total: channels.length,
        categories,
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playlist error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}

// Keep proxy URL helper exported for channels route
export { proxyChannelUrl };
