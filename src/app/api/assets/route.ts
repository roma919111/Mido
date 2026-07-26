import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  listAssetsForUser,
  recoverOrphanedHiddenAssets,
  updateAsset,
} from "@/lib/db";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import { appendVyronixOutro } from "@/lib/veronix-outro";

export const runtime = "nodejs";
export const maxDuration = 120;

function needsLocalBrand(asset: {
  mediaType: string;
  model: string;
  mode?: string;
  creditsUsed: number;
  url: string;
  status: string;
}) {
  if (asset.mediaType !== "video") return false;
  if (asset.model !== VERONIX_MODEL_ID) return false;
  // Stitched multi-shot finals must never get the free-trial intro treatment.
  if (asset.mode === "sequence-concat") return false;
  if (asset.creditsUsed !== 0) return false;
  if (asset.status !== "completed" && asset.status !== "running") return false;
  if (!asset.url || asset.url.startsWith("/generations/")) return false;
  return true;
}

/** Refresh running assets from OpenArt; brand free Veronix clips locally. */
async function syncRunningAssets(userId: string) {
  const assets = await listAssetsForUser(userId, { includeHidden: true });
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
        let finalUrl = urls[0] || asset.url;
        if (
          finalUrl &&
          needsLocalBrand({
            ...asset,
            url: finalUrl,
            status: "completed",
          })
        ) {
          try {
            finalUrl = await appendVyronixOutro(finalUrl);
          } catch {
            // Keep OpenArt URL; client brand-outro may still succeed.
          }
        }
        await updateAsset(asset.id, userId, {
          url: finalUrl,
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

  // Brand any completed free Veronix clips that still point at OpenArt CDN.
  const latest = await listAssetsForUser(userId);
  for (const asset of latest.filter(needsLocalBrand).slice(0, 4)) {
    try {
      const branded = await appendVyronixOutro(asset.url);
      await updateAsset(asset.id, userId, { url: branded, status: "completed" });
    } catch {
      // retry next load
    }
  }
  return listAssetsForUser(userId, { includeHidden: false });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
  }
  try {
    // Restore paid multi-shot clips if stitch never produced a visible final.
    await recoverOrphanedHiddenAssets(user.id);
    const assets = await syncRunningAssets(user.id);
    return NextResponse.json({ assets });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      await recoverOrphanedHiddenAssets(user.id).catch(() => 0);
      const assets = await listAssetsForUser(user.id);
      return NextResponse.json({ assets, syncSkipped: true });
    }
    await recoverOrphanedHiddenAssets(user.id).catch(() => 0);
    const assets = await listAssetsForUser(user.id);
    return NextResponse.json({ assets });
  }
}
