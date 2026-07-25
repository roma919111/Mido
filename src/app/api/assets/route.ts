import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { listAssetsForUser, updateAsset } from "@/lib/db";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const runtime = "nodejs";

/** Refresh running assets from OpenArt so customers keep completed media in their account. */
async function syncRunningAssets(userId: string) {
  const assets = await listAssetsForUser(userId);
  const running = assets.filter((a) => a.status === "running" && a.historyId).slice(0, 8);
  for (const asset of running) {
    try {
      const result = await callOpenArtTool("openart_creation_get", {
        historyId: asset.historyId,
      });
      const payload = parseToolPayload(result);
      if (result.isError) continue;
      const status = String(payload.status ?? payload.state ?? "").toUpperCase();
      const urls = collectMediaUrls(payload);
      if (urls.length > 0 || status === "COMPLETED") {
        await updateAsset(asset.id, userId, {
          url: urls[0] || asset.url,
          status: "completed",
          error: undefined,
        });
      } else if (status === "FAILED" || status === "CANCELLED") {
        await updateAsset(asset.id, userId, {
          status: "failed",
          error: String(payload.error ?? payload.message ?? "Generation failed"),
        });
      }
    } catch {
      // leave as running; next poll retries
    }
  }
  return listAssetsForUser(userId);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
  }
  try {
    const assets = await syncRunningAssets(user.id);
    return NextResponse.json({ assets });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      const assets = await listAssetsForUser(user.id);
      return NextResponse.json({ assets, syncSkipped: true });
    }
    const assets = await listAssetsForUser(user.id);
    return NextResponse.json({ assets });
  }
}
