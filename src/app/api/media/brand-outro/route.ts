import { NextResponse } from "next/server";
import {
  getBytePlusVideoTask,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
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
  // Prefer historyId lookup so we always get a fresh CDN URL.
  if (input.historyId?.trim()) {
    const historyId = input.historyId.trim();
    const bpId = parseBytePlusHistoryId(historyId);
    if (bpId) {
      const task = await getBytePlusVideoTask(bpId);
      if (task.content?.video_url) return task.content.video_url;
    } else {
      const result = await callOpenArtTool("openart_creation_get", { historyId });
      const payload = parseToolPayload(result);
      if (!result.isError) {
        const fromHistory = collectMediaUrls(payload)[0];
        if (fromHistory) return fromHistory;
      }
    }
  }

  const raw = input.url?.trim();
  if (!raw) return null;
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

    let brandedPath: string;
    try {
      brandedPath = await appendVyronixOutro(source);
    } catch (firstErr) {
      // One retry after short delay (CDN/OpenArt blips).
      await new Promise((r) => setTimeout(r, 1500));
      const retrySource = (await resolveSourceUrl(body)) || source;
      try {
        brandedPath = await appendVyronixOutro(retrySource);
      } catch {
        throw firstErr;
      }
    }

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
