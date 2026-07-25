import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { isAllowedMediaHost } from "@/lib/media-proxy";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";
export const maxDuration = 120;

function resolveLocalGeneration(localPath: string): string | null {
  if (!localPath.startsWith("/generations/")) return null;
  const base = path.resolve(process.cwd(), "public", "generations");
  const file = path.resolve(process.cwd(), "public", localPath.replace(/^\//, ""));
  if (!file.startsWith(base + path.sep)) return null;
  return file;
}

async function resolveRemoteUrl(request: Request): Promise<{
  url: string;
  mediaType: "image" | "video";
} | null> {
  const { searchParams } = new URL(request.url);
  const mediaType =
    searchParams.get("type") === "image" ? ("image" as const) : ("video" as const);

  const local = searchParams.get("local")?.trim();
  if (local) {
    const filePath = resolveLocalGeneration(local);
    if (!filePath) return null;
    return { url: `file://${filePath}`, mediaType };
  }

  const historyId = searchParams.get("historyId")?.trim();
  if (historyId) {
    const result = await callOpenArtTool("openart_creation_get", { historyId });
    const payload = parseToolPayload(result);
    if (result.isError) return null;
    const url = collectMediaUrls(payload)[0];
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

/** Inline media proxy — playback never exposes OpenArt CDN to the browser. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const local = searchParams.get("local")?.trim();
    if (local) {
      const filePath = resolveLocalGeneration(local);
      if (!filePath) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await access(filePath);
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": 'inline; filename="veronix.mp4"',
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const source = await resolveRemoteUrl(request);
    if (!source || source.url.startsWith("file://")) {
      return NextResponse.json({ error: "Media not ready" }, { status: 404 });
    }

    const upstream = await fetch(source.url, {
      headers: { Accept: "*/*" },
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
      (source.mediaType === "video" ? "video/mp4" : "image/png");

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'inline; filename="veronix.mp4"',
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stream failed" },
      { status: 500 },
    );
  }
}
