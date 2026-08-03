import { createReadStream, statSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { isAllowedMediaHost } from "@/lib/media-proxy";
import { resolveHistoryVideoUrl } from "@/lib/resolve-history-url";
import { resolveGenerationFile } from "@/lib/veronix-outro";

export const runtime = "nodejs";
export const maxDuration = 120;

async function resolveRemoteUrl(request: Request): Promise<{
  url: string;
  mediaType: "image" | "video";
} | null> {
  const { searchParams } = new URL(request.url);
  const mediaType =
    searchParams.get("type") === "image" ? ("image" as const) : ("video" as const);

  const local = searchParams.get("local")?.trim();
  if (local) {
    const filePath = resolveGenerationFile(local);
    if (!filePath) return null;
    return { url: `file://${filePath}`, mediaType };
  }

  const historyId = searchParams.get("historyId")?.trim();
  if (historyId) {
    const url = await resolveHistoryVideoUrl(historyId);
    if (!url) return null;
    return { url, mediaType };
  }

  const encoded = searchParams.get("u")?.trim();
  if (!encoded) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  try {
    const parsed = new URL(decoded);
    if (!isAllowedMediaHost(parsed.hostname)) return null;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return { url: parsed.toString(), mediaType };
  } catch {
    return null;
  }
}

function parseRange(
  rangeHeader: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return null;
  const startRaw = m[1];
  const endRaw = m[2];
  let start = startRaw ? Number(startRaw) : NaN;
  let end = endRaw ? Number(endRaw) : NaN;
  if (!Number.isFinite(start) && Number.isFinite(end)) {
    // suffix bytes: "-N"
    const suffix = end;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
  }
  if (start < 0 || end < start || start >= size) return null;
  return { start, end };
}

function localFileResponse(
  filePath: string,
  request: Request,
  mediaType: "image" | "video",
): NextResponse {
  const size = statSync(filePath).size;
  const contentType =
    mediaType === "video"
      ? "video/mp4"
      : filePath.toLowerCase().endsWith(".png")
        ? "image/png"
        : filePath.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
  const range = parseRange(request.headers.get("range"), size);

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Disposition": 'inline; filename="veronix.mp4"',
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": 'inline; filename="veronix.mp4"',
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Inline media proxy — Range-aware so mobile scrubbing / TikTok-style browse stays smooth. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mediaType =
      searchParams.get("type") === "image" ? ("image" as const) : ("video" as const);
    const local = searchParams.get("local")?.trim();
    if (local) {
      const filePath = resolveGenerationFile(local);
      if (!filePath) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await access(filePath);
      await stat(filePath);
      return localFileResponse(filePath, request, mediaType);
    }

    const source = await resolveRemoteUrl(request);
    if (!source || source.url.startsWith("file://")) {
      return NextResponse.json({ error: "Media not ready" }, { status: 404 });
    }

    const range = request.headers.get("range");
    const upstream = await fetch(source.url, {
      headers: {
        Accept: "*/*",
        "User-Agent": "VyronixMedia/1.0",
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream media failed (${upstream.status})` },
        { status: 502 },
      );
    }

    const contentType =
      upstream.headers.get("content-type") ||
      (source.mediaType === "video" ? "video/mp4" : "image/jpeg");

    const filename = source.mediaType === "video" ? "veronix.mp4" : "veronix.jpg";
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
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
