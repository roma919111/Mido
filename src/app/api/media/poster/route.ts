import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getBytePlusVideoTask,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import { getCurrentUser } from "@/lib/customer-auth";
import { isAllowedMediaHost } from "@/lib/media-proxy";
import { resolveGenerationFile } from "@/lib/veronix-outro";
import { extractFirstFrameJpeg } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 60;

const POSTER_DIR = path.join(process.cwd(), ".data", "posters");

function cacheKey(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 24);
}

async function resolveVideoSource(request: Request): Promise<string | null> {
  const { searchParams } = new URL(request.url);

  const local = searchParams.get("local")?.trim();
  if (local) {
    const filePath = resolveGenerationFile(local);
    if (!filePath) return null;
    return `file://${filePath}`;
  }

  const historyId = searchParams.get("historyId")?.trim();
  if (historyId) {
    const bpId = parseBytePlusHistoryId(historyId);
    if (bpId) {
      const task = await getBytePlusVideoTask(bpId);
      return task.content?.video_url || null;
    }
    return null;
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
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Cached JPEG poster (first frame) for Assets feed thumbnails. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const keySrc =
      searchParams.get("local") ||
      searchParams.get("historyId") ||
      searchParams.get("u") ||
      "";
    if (!keySrc) {
      return NextResponse.json({ error: "missing media" }, { status: 400 });
    }

    await mkdir(POSTER_DIR, { recursive: true });
    const file = path.join(POSTER_DIR, `${cacheKey(keySrc)}.jpg`);
    try {
      await access(file);
      const buf = await readFile(file);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=86400, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // generate below
    }

    const source = await resolveVideoSource(request);
    if (!source) {
      return NextResponse.json({ error: "Media not ready" }, { status: 404 });
    }

    const jpeg = await extractFirstFrameJpeg(source);
    await writeFile(file, jpeg);
    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Poster failed" },
      { status: 500 },
    );
  }
}
