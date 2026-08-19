import { NextResponse } from "next/server";
import { loginIptvServer } from "@/lib/iptv-login";
import { getPlayerMediaOrigin } from "@/lib/request-origin";

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

/** Login → session + live categories (movies/series load on demand). */
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

  const origin = getPlayerMediaOrigin(request);

  try {
    const result = await loginIptvServer({ host, username, password }, origin);
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playlist error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
