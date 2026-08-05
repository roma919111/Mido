import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getGeminiVideoPath } from "@/lib/gemini-video";

export const runtime = "nodejs";

function parseRange(
  rangeHeader: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;

  if (!Number.isFinite(start) && Number.isFinite(end)) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
  }

  if (start < 0 || end < start || start >= size) return null;
  return { start, end };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ interactionId: string }> },
) {
  const { interactionId } = await context.params;
  const decodedId = decodeURIComponent(interactionId);
  const filePath = getGeminiVideoPath(decodedId);

  try {
    await access(filePath);
    const size = (await stat(filePath)).size;
    const range = parseRange(request.headers.get("range"), size);

    if (range) {
      const { start, end } = range;
      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not ready" }, { status: 404 });
  }
}
