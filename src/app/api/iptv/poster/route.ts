import { NextResponse } from "next/server";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";

export const runtime = "nodejs";

function corsHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    ...extra,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Proxy HTTP poster images for HTTPS pages (mixed content). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const srcB64 = url.searchParams.get("src");
  if (!srcB64) {
    return NextResponse.json({ error: "src required" }, { status: 400, headers: corsHeaders() });
  }

  let target: string;
  try {
    target = Buffer.from(srcB64, "base64url").toString("utf8");
    assertSafeIptvUrl(target);
  } catch {
    return NextResponse.json({ error: "Invalid poster URL" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "MAX-IPTV/1.0", Accept: "image/*,*/*" },
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Poster unavailable" }, { status: 502, headers: corsHeaders() });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = upstream.body;
    if (!body) {
      return NextResponse.json({ error: "Empty poster" }, { status: 502, headers: corsHeaders() });
    }

    return new NextResponse(body, {
      headers: corsHeaders({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Poster proxy error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
