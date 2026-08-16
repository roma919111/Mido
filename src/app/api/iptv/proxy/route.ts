import { NextResponse } from "next/server";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";
import { getRequestPublicOrigin } from "@/lib/request-origin";

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

function proxyUrl(request: Request, target: string): string {
  const origin = getRequestPublicOrigin(request);
  const b64 = Buffer.from(target, "utf8").toString("base64url");
  return `${origin}/api/iptv/proxy?src=${b64}`;
}

function isManifest(contentType: string, target: string): boolean {
  return (
    contentType.includes("mpegurl") ||
    contentType.includes("x-mpegURL") ||
    target.includes(".m3u8")
  );
}

function resolveTarget(srcB64: string | null): string | null {
  if (!srcB64) return null;
  try {
    const target = Buffer.from(srcB64, "base64url").toString("utf8");
    assertSafeIptvUrl(target);
    return target;
  } catch {
    return null;
  }
}

/** Proxy HLS/live stream for browser playback (CORS + mixed content). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const srcB64 = url.searchParams.get("src");
  const target = resolveTarget(srcB64);

  if (!target) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404, headers: corsHeaders() });
  }

  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "MAX-IPTV/1.0", Accept: "*/*" },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Stream unavailable (${upstream.status})` },
        { status: 502, headers: corsHeaders() },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

    if (isManifest(contentType, target)) {
      const text = await upstream.text();
      const base = new URL(target);
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          try {
            const abs = new URL(trimmed, base).toString();
            return proxyUrl(request, abs);
          } catch {
            return line;
          }
        })
        .join("\n");

      return new NextResponse(rewritten, {
        headers: corsHeaders({
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
        }),
      });
    }

    const body = upstream.body;
    if (!body) {
      return NextResponse.json({ error: "Empty stream" }, { status: 502, headers: corsHeaders() });
    }

    return new NextResponse(body, {
      headers: corsHeaders({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
