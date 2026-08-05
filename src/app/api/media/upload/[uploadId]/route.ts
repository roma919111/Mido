import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getUploadPath } from "@/lib/local-upload";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  const { uploadId } = await context.params;
  const decodedId = decodeURIComponent(uploadId);
  const filePath = getUploadPath(decodedId);

  try {
    await access(filePath);
    const size = (await stat(filePath)).size;
    const contentType = decodedId.endsWith(".png")
      ? "image/png"
      : decodedId.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }
}
