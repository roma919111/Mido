import { NextResponse } from "next/server";
import { fetchAndParseM3u } from "@/lib/m3u-parser";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";
import { buildM3uPlusUrl, verifyXtreamLogin, type XtreamCredentials } from "@/lib/xtream-url";

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

  try {
    const m3uUrl = buildM3uPlusUrl(creds);
    assertSafeIptvUrl(m3uUrl);

    await verifyXtreamLogin(creds).catch(() => {
      /* Some providers omit player_api — continue with M3U fetch */
    });

    const channels = await fetchAndParseM3u(m3uUrl);
    const origin = new URL(request.url).origin;

    return NextResponse.json(
      {
        host,
        username,
        label: username,
        channels: channels.map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group ?? null,
          logo: c.logo ?? null,
          url: `${origin}/api/iptv/proxy?id=${encodeURIComponent(c.id)}&src=${Buffer.from(c.url, "utf8").toString("base64url")}`,
        })),
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playlist error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
