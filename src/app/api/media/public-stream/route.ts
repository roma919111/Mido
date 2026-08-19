import { createReadStream, statSync } from "node:fs";
import { access } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { findAssetByIdGlobal } from "@/lib/db";
import { resolveGenerationFile } from "@/lib/veronix-outro";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function localFileResponse(filePath: string, request: Request): NextResponse {
  const size = statSync(filePath).size;
  const contentType = "video/mp4";
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
        "Content-Disposition": 'inline; filename="vyronix-feed.mp4"',
        "Cache-Control": "public, max-age=3600",
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
      "Content-Disposition": 'inline; filename="vyronix-feed.mp4"',
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Public playback for published home-feed videos only. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId")?.trim();
    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const asset = await findAssetByIdGlobal(assetId);
    if (
      !asset?.publishedAt ||
      asset.deletedAt ||
      asset.hidden ||
      asset.status !== "completed" ||
      asset.mediaType !== "video"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const localPath = asset.url.replace(/^\/generations\//, "");
    const filePath = resolveGenerationFile(localPath);
    if (!filePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await access(filePath);
    return localFileResponse(filePath, request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stream failed" },
      { status: 500 },
    );
  }
}
