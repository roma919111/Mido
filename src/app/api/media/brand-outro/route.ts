import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { listAssetsForUser, updateAsset } from "@/lib/db";
import { isAllowedMediaHost } from "@/lib/media-proxy";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import { appendVyronixOutro } from "@/lib/veronix-outro";

export const runtime = "nodejs";
export const maxDuration = 120;

async function resolveSourceUrl(input: {
  url?: string;
  historyId?: string;
}): Promise<string | null> {
  if (input.historyId?.trim()) {
    const result = await callOpenArtTool("openart_creation_get", {
      historyId: input.historyId.trim(),
    });
    const payload = parseToolPayload(result);
    if (result.isError) return null;
    return collectMediaUrls(payload)[0] || null;
  }
  const raw = input.url?.trim();
  if (!raw) return null;
  // Already branded local file — return as-is (idempotent).
  if (raw.startsWith("/generations/")) return raw;
  try {
    const parsed = new URL(raw);
    if (!isAllowedMediaHost(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      url?: string;
      historyId?: string;
      assetId?: string;
    };

    const source = await resolveSourceUrl(body);
    if (!source) {
      return NextResponse.json({ error: "Source video not ready" }, { status: 404 });
    }
    if (source.startsWith("/generations/")) {
      return NextResponse.json({ url: source, branded: true, reused: true });
    }

    const brandedPath = await appendVyronixOutro(source);

    if (body.assetId || body.historyId) {
      const assets = await listAssetsForUser(user.id);
      const mine = assets.find(
        (a) =>
          (body.assetId && a.id === body.assetId) ||
          (body.historyId && a.historyId === body.historyId),
      );
      if (mine) {
        await updateAsset(mine.id, user.id, {
          url: brandedPath,
          status: "completed",
        });
      }
    }

    return NextResponse.json({ url: brandedPath, branded: true });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brand outro failed" },
      { status: 500 },
    );
  }
}
