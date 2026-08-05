import { NextResponse } from "next/server";
import { fetchAndParseM3u } from "@/lib/m3u-parser";
import { getIptvCode, normalizeCode } from "@/lib/iptv-codes";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

function proxyUrl(request: Request, code: string, target: string): string {
  const base = new URL(request.url);
  const b64 = Buffer.from(target, "utf8").toString("base64url");
  return `${base.origin}/api/max/iptv/proxy?code=${encodeURIComponent(code)}&url=${b64}`;
}

function isManifest(contentType: string, target: string): boolean {
  return (
    contentType.includes("mpegurl") ||
    contentType.includes("x-mpegURL") ||
    target.includes(".m3u8")
  );
}

async function resolveTarget(code: string, channelId: string | null, directB64: string | null): Promise<string | null> {
  if (directB64) {
    try {
      return Buffer.from(directB64, "base64url").toString("utf8");
    } catch {
      return null;
    }
  }
  if (!channelId) return null;
  const record = await getIptvCode(code);
  if (!record?.active) return null;
  const channels = await fetchAndParseM3u(record.m3uUrl);
  return channels.find((c) => c.id === channelId)?.url ?? null;
}

/** Proxy stream / HLS manifest for browser playback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code") ?? "");
  const channelId = url.searchParams.get("id");
  const directB64 = url.searchParams.get("url");

  if (code.length < 4) {
    return NextResponse.json({ error: "code required" }, { status: 400, headers: maxApiCors });
  }

  const record = await getIptvCode(code);
  if (!record?.active) {
    return NextResponse.json({ error: "Invalid code" }, { status: 403, headers: maxApiCors });
  }

  const target = await resolveTarget(code, channelId, directB64);
  if (!target) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404, headers: maxApiCors });
  }

  const upstream = await fetch(target, {
    headers: { "User-Agent": "MAX-IPTV/1.0", Accept: "*/*" },
    redirect: "follow",
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: `Stream unavailable (${upstream.status})` }, { status: 502, headers: maxApiCors });
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
          const absolute = new URL(trimmed, base).href;
          return proxyUrl(request, code, absolute);
        } catch {
          return line;
        }
      })
      .join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        ...maxApiCors,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      ...maxApiCors,
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
