import { NextResponse } from "next/server";
import { decodeMediaProxyParam } from "@/lib/media-proxy";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("type") === "image" ? "image" : "video";
  const encoded = searchParams.get("u")?.trim();

  if (!encoded) {
    return NextResponse.json({ error: "Media not ready" }, { status: 404 });
  }

  const sourceUrl = decodeMediaProxyParam(encoded);
  if (!sourceUrl) {
    return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
  }

  try {
    const range = request.headers.get("range");
    const upstream = await fetch(sourceUrl, {
      headers: {
        Accept: "*/*",
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
    });

    if (upstream.status === 404 || upstream.status === 403) {
      return NextResponse.json({ error: "Media not ready" }, { status: 404 });
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream media failed (${upstream.status})` },
        { status: 502 },
      );
    }

    const contentType =
      upstream.headers.get("content-type") ||
      (mediaType === "video" ? "video/mp4" : "image/jpeg");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="vyronix.${mediaType === "video" ? "mp4" : "jpg"}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    };

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers["Content-Range"] = contentRange;

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stream failed" },
      { status: 500 },
    );
  }
}
