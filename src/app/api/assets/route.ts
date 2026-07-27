import { NextResponse } from "next/server";
import {
  createBytePlusVideoTask,
  getBytePlusVideoTask,
  mapBytePlusStatus,
  parseBytePlusHistoryId,
  toBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  listAssetsForUser,
  recoverOrphanedHiddenAssets,
  recoverStuckSequencePending,
  updateAsset,
} from "@/lib/db";
import { PRODUCT_PER_SHOT_SECONDS } from "@/lib/shot-plan";
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

/** Refresh running assets from BytePlus (primary) or legacy OpenArt ids. */
async function syncRunningAssets(userId: string) {
  const assets = await listAssetsForUser(userId, { includeHidden: true });
  const running = assets.filter((a) => a.status === "running" && a.historyId).slice(0, 8);
  for (const asset of running) {
    try {
      const bpId = parseBytePlusHistoryId(asset.historyId || "");
      if (bpId) {
        const task = await getBytePlusVideoTask(bpId);
        const status = mapBytePlusStatus(task.status);
        const videoUrl = task.content?.video_url || "";
        if (videoUrl || status === "COMPLETED") {
          let finalUrl = videoUrl || asset.url;
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
              // keep remote URL
            }
          }
          // Persist URL so Assets can play even if history CDN expires later.
          // sequence-part beats stay hidden — only the stitched card is shown.
          await updateAsset(asset.id, userId, {
            url: finalUrl,
            status: "completed",
            error: undefined,
            hidden: asset.mode === "sequence-part" ? true : asset.hidden === true,
          });
        } else if (status === "FAILED") {
          const errMsg =
            typeof task.error === "string"
              ? task.error
              : task.error && typeof task.error === "object"
                ? String(task.error.message || task.error.code || "BytePlus generation failed")
                : "BytePlus generation failed";
          const alreadyMuted = Boolean(asset.error?.includes("[muted-retry]"));
          const sensitive = /OutputAudioSensitive|SensitiveContent|sensitive/i.test(
            errMsg,
          );
          if (sensitive && !alreadyMuted && asset.prompt?.trim()) {
            try {
              const rawDuration = Number(
                (task.raw as { duration?: number }).duration || 0,
              );
              const duration =
                rawDuration > 0
                  ? rawDuration
                  : asset.mode === "sequence-part"
                    ? PRODUCT_PER_SHOT_SECONDS
                    : 8;
              const retry = await createBytePlusVideoTask({
                prompt: asset.prompt
                  .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
                  .trim(),
                duration,
                ratio: "16:9",
                generateAudio: false,
                watermark: false,
              });
              await updateAsset(asset.id, userId, {
                historyId: toBytePlusHistoryId(retry.id),
                status: "running",
                url: "",
                error: "[muted-retry] إعادة التوليد بدون صوت بسبب حساسية الصوت",
                hidden: asset.mode === "sequence-part" ? true : false,
              });
              continue;
            } catch {
              // fall through to mark failed
            }
          }
          await updateAsset(asset.id, userId, {
            status: "failed",
            error: errMsg,
            // Keep failed beats hidden; the job card carries the error.
            hidden: asset.mode === "sequence-part" ? true : false,
          });
        }
        continue;
      }

      // Legacy OpenArt history ids only (pre–BytePlus-only).
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
            // Keep remote URL; client brand-outro may still succeed.
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

  // Brand any completed free Veronix clips that still point at a remote CDN.
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
    await recoverStuckSequencePending(user.id);
    const assets = await syncRunningAssets(user.id);
    return NextResponse.json({ assets });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      await recoverOrphanedHiddenAssets(user.id).catch(() => 0);
      await recoverStuckSequencePending(user.id).catch(() => 0);
      const assets = await listAssetsForUser(user.id);
      return NextResponse.json({ assets, syncSkipped: true });
    }
    await recoverOrphanedHiddenAssets(user.id).catch(() => 0);
    await recoverStuckSequencePending(user.id).catch(() => 0);
    const assets = await listAssetsForUser(user.id);
    return NextResponse.json({ assets });
  }
}
