import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getGeminiImagePath } from "@/lib/gemini-image";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await context.params;
  const decodedId = decodeURIComponent(imageId);
  const filePath = getGeminiImagePath(decodedId);

  try {
    await access(filePath);
    const size = (await stat(filePath)).size;
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not ready" }, { status: 404 });
  }
}
