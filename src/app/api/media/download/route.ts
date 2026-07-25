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

function safeFilename(name: string | null, mediaType: "image" | "video") {
  const fallback = mediaType === "video" ? "veronix.mp4" : "veronix.png";
  if (!name) return fallback;
  const cleaned = name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  if (!/\.(mp4|webm|mov|png|jpe?g|webp|gif)$/i.test(cleaned)) {
    return `${cleaned}${mediaType === "video" ? ".mp4" : ".png"}`;
  }
  return cleaned;
}

async function resolveSourceUrl(request: Request): Promise<{
  url: string;
  mediaType: "image" | "video";
  filename: string;
} | null> {
  const { searchParams } = new URL(request.url);
  const mediaType =
    searchParams.get("type") === "image" ? ("image" as const) : ("video" as const);
  const filename = safeFilename(searchParams.get("filename"), mediaType);
  const historyId = searchParams.get("historyId")?.trim();

  if (historyId) {
    const result = await callOpenArtTool("openart_creation_get", { historyId });
    const payload = parseToolPayload(result);
    if (result.isError) return null;
    const urls = collectMediaUrls(payload);
    const url = urls[0];
    if (!url) return null;
    return { url, mediaType, filename };
  }

  const encoded = searchParams.get("u")?.trim();
  if (!encoded) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(decoded);
  } catch {
    return null;
  }
  if (!isAllowedMediaHost(parsed.hostname)) return null;
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return { url: parsed.toString(), mediaType, filename };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const source = await resolveSourceUrl(request);
    if (!source) {
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
        "Content-Disposition": `attachment; filename="${source.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 },
    );
  }
}
