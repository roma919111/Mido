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
  deleteAssetForUser,
} from "@/lib/db";
import { PRODUCT_PER_SHOT_SECONDS } from "@/lib/shot-plan";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import { toSemiRealisticScenePrompt } from "@/lib/reference-sanitize";
import { ensureClarityUrl, needsClarityGrade } from "@/lib/ensure-clarity";
import { concatVideos } from "@/lib/video-stitch";
import { tickUserMultiShotJobs, isMultiShotStillGenerating } from "@/lib/multi-shot-job";
import { estimateGenerateSeconds } from "@/lib/generate-eta";
import {
  callOpenArtTool,
  collectMediaUrls,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import { appendVyronixOutro } from "@/lib/veronix-outro";

export const runtime = "nodejs";
export const maxDuration = 180;

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

/**
 * When a pending multi-shot job has ≥2 completed hidden parts and nothing
 * still running, stitch them into one clarity-graded video.
 */
async function stitchPendingJobs(userId: string) {
  const assets = await listAssetsForUser(userId, { includeHidden: true });
  const pendings = assets
    .filter(
      (a) =>
        a.mode === "sequence-pending" &&
        a.status === "running" &&
        !a.url,
    )
    .slice(0, 3);

  for (const pending of pendings) {
    // Server multi-shot jobs own their lifecycle — do not collapse early.
    if (isMultiShotStillGenerating(pending)) continue;

    const pendingAt = new Date(pending.createdAt).getTime();
    const parts = assets
      .filter((a) => {
        if (a.mode !== "sequence-part") return false;
        const t = new Date(a.createdAt).getTime();
        return t >= pendingAt - 5_000 && t < pendingAt + 3 * 60 * 60 * 1000;
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    if (parts.some((p) => p.status === "running")) continue;
    const done = parts.filter((p) => p.status === "completed" && p.url);
    const urls = done.map((p) => p.url);
    const ageMs = Date.now() - pendingAt;
    const expectedBeats = Math.max(
      1,
      Math.round((pending.targetSeconds || 4) / PRODUCT_PER_SHOT_SECONDS),
    );
    const etaMs = estimateGenerateSeconds(pending.targetSeconds || urls.length * 4) * 1000;
    // Never force-deliver a partial before the full ETA window — otherwise
    // 32s jobs get collapsed to a single 4s clip while later beats are still planned.
    if (urls.length === 0) continue;
    if (urls.length < expectedBeats && ageMs < etaMs + 60_000) continue;
    if (urls.length === 1 && ageMs < Math.max(etaMs, 90_000)) continue;

    try {
      let finalUrl: string;
      if (urls.length >= 2) {
        finalUrl = await concatVideos(urls, {
          maxSecondsPerClip: PRODUCT_PER_SHOT_SECONDS,
          clarity: true,
        });
      } else {
        finalUrl = await ensureClarityUrl(urls[0]!);
      }
      await updateAsset(pending.id, userId, {
        url: finalUrl,
        status: "completed",
        mode: "sequence-concat",
        error:
          urls.length === 1
            ? "اكتملت لقطة واحدة — عُرض المتاح (أعد التوليد لمدة أطول)"
            : undefined,
        hidden: false,
        targetSeconds: urls.length * PRODUCT_PER_SHOT_SECONDS,
      });
      for (const p of parts) {
        if (p.hidden !== true) {
          await updateAsset(p.id, userId, { hidden: true });
        }
      }
    } catch (err) {
      console.warn(
        "[veronix] stitchPendingJobs failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
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
          // Visible finals always get clarity; parts stay raw for stitch.
          if (finalUrl && asset.mode !== "sequence-part") {
            finalUrl = await ensureClarityUrl(finalUrl);
          }
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
          const alreadyPrivacy = Boolean(asset.error?.includes("[privacy-retry]"));
          const sensitive = /OutputAudioSensitive|SensitiveContent|sensitive/i.test(
            errMsg,
          );
          const privacy = /InputImageSensitive|PrivacyInformation|real person/i.test(
            errMsg,
          );
          if (privacy && !alreadyPrivacy && asset.prompt?.trim()) {
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
              // Rewrite as semi-realistic cinematic scene (no real-person photo intent).
              const retry = await createBytePlusVideoTask({
                prompt: toSemiRealisticScenePrompt(asset.prompt),
                duration,
                ratio: "16:9",
                generateAudio: false,
                watermark: false,
              });
              await updateAsset(asset.id, userId, {
                historyId: toBytePlusHistoryId(retry.id),
                status: "running",
                url: "",
                error:
                  "[privacy-retry] أُعيد كتابة الوصف كمشهد شبه واقعي وأُعيد التوليد",
                hidden: asset.mode === "sequence-part" ? true : false,
              });
              continue;
            } catch {
              // fall through
            }
          }
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

  // Lazy clarity grade for visible completed videos still on raw CDN / ungraded parts.
  for (const asset of latest
    .filter(
      (a) =>
        a.status === "completed" &&
        a.mediaType === "video" &&
        a.mode !== "sequence-part" &&
        a.hidden !== true &&
        needsClarityGrade(a.url),
    )
    .slice(0, 4)) {
    try {
      const graded = await ensureClarityUrl(asset.url);
      if (graded && graded !== asset.url) {
        await updateAsset(asset.id, userId, { url: graded });
      }
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
    // Kick / resume in-process multi-shot runners (non-blocking).
    {
      const all = await listAssetsForUser(user.id, { includeHidden: true });
      await tickUserMultiShotJobs(user.id, all);
    }
    await stitchPendingJobs(user.id);
    const assets = await syncRunningAssets(user.id);
    return NextResponse.json({ assets });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      await recoverOrphanedHiddenAssets(user.id).catch(() => 0);
      await recoverStuckSequencePending(user.id).catch(() => 0);
      await stitchPendingJobs(user.id).catch(() => 0);
      const assets = await listAssetsForUser(user.id);
      return NextResponse.json({ assets, syncSkipped: true });
    }
    await recoverOrphanedHiddenAssets(user.id).catch(() => 0);
    await recoverStuckSequencePending(user.id).catch(() => 0);
    await stitchPendingJobs(user.id).catch(() => 0);
    const assets = await listAssetsForUser(user.id);
    return NextResponse.json({ assets });
  }
}

/** Soft-delete an asset (permanent for the customer — not restored on login). */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const ok = await deleteAssetForUser(user.id, id);
    if (!ok) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 },
    );
  }
}
