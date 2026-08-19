import { NextResponse } from "next/server";
import {
  getBytePlusVideoTask,
  mapBytePlusStatus,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import {
  parseMiniMaxHistoryId,
  tryRecoverMiniMaxAsset,
} from "@/lib/minimax-video";
import {
  findUserByEmail,
  listAssetsForAdmin,
  listUsersForAdmin,
  recoverStuckSequencePending,
  updateAsset,
} from "@/lib/db";
import {
  ensureMultiShotBackground,
  isMultiShotJobMeta,
  isMultiShotStillGenerating,
  tickMultiShotJob,
} from "@/lib/multi-shot-job";
import { estimateGenerateSeconds } from "@/lib/generate-eta";
import { PRODUCT_PER_SHOT_SECONDS } from "@/lib/shot-plan";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  email?: string;
  /** Repair every user (capped). */
  all?: boolean;
};

/**
 * Ops: pull BytePlus URLs into Assets and unhide stuck completed clips.
 * Requires x-admin-secret = AUTH_SECRET.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-admin-secret")?.trim();
    const expected = process.env.AUTH_SECRET?.trim();
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const targets: Array<{ id: string; email: string }> = [];

    if (body.all) {
      const users = await listUsersForAdmin();
      for (const u of users.slice(0, 50)) {
        const full = await findUserByEmail(u.email);
        if (full) targets.push({ id: full.id, email: full.email });
      }
    } else {
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }
      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      targets.push({ id: user.id, email: user.email });
    }

    const report: Array<Record<string, unknown>> = [];

    for (const t of targets) {
      await recoverStuckSequencePending(t.id).catch(() => 0);
      const assets = await listAssetsForAdmin(t.id, 80);
      // Resume any server multi-shot jobs instead of collapsing them early.
      for (const a of assets) {
        if (
          a.mode === "sequence-pending" &&
          a.status === "running" &&
          isMultiShotJobMeta(a.jobMeta)
        ) {
          ensureMultiShotBackground(t.id, a.id);
        }
      }
      let fixed = 0;
      let unhidden = 0;
      let rehiddenParts = 0;
      for (const asset of assets) {
        const mmId = parseMiniMaxHistoryId(asset.historyId || "");
        if (
          mmId &&
          (asset.status === "failed" ||
            asset.status === "running" ||
            !asset.url)
        ) {
          try {
            const result = await tryRecoverMiniMaxAsset({
              userId: t.id,
              assetId: asset.id,
              historyId: asset.historyId || "",
              hidden: asset.hidden === true,
              mode: asset.mode,
            });
            if (result === "completed") fixed += 1;
          } catch {
            // skip
          }
        }
        // Intermediate beats must stay hidden forever.
        if (asset.mode === "sequence-part" && asset.hidden !== true) {
          await updateAsset(asset.id, t.id, { hidden: true });
          rehiddenParts += 1;
        }
        const bpId = parseBytePlusHistoryId(asset.historyId || "");
        if (bpId && (asset.status === "running" || !asset.url)) {
          try {
            const task = await getBytePlusVideoTask(bpId, asset.model || undefined);
            const status = mapBytePlusStatus(task.status);
            const url = task.content?.video_url || "";
            if (url) {
              await updateAsset(asset.id, t.id, {
                url,
                status: "completed",
                error: undefined,
                // Never expose intermediate beats in Assets.
                hidden: asset.mode === "sequence-part" ? true : false,
              });
              fixed += 1;
            } else if (status === "FAILED") {
              await updateAsset(asset.id, t.id, {
                status: "failed",
                error:
                  typeof task.error === "string"
                    ? task.error
                    : "BytePlus generation failed",
                hidden: asset.mode === "sequence-part" ? true : false,
              });
              fixed += 1;
            }
          } catch {
            // skip
          }
        } else if (
          asset.hidden === true &&
          !asset.deletedAt &&
          asset.status === "completed" &&
          asset.url &&
          asset.mode !== "sequence-part"
        ) {
          await updateAsset(asset.id, t.id, { hidden: false });
          unhidden += 1;
        } else if (
          asset.mode === "sequence-pending" &&
          (asset.status === "running" || asset.status === "failed") &&
          !asset.url
        ) {
          // Still generating the planned duration — tick, don't force early.
          if (isMultiShotStillGenerating(asset)) {
            try {
              await tickMultiShotJob(t.id, asset);
              fixed += 1;
            } catch {
              // background runner will retry
            }
            continue;
          }
          const pendingAt = new Date(asset.createdAt).getTime();
          const ageMs = Date.now() - pendingAt;
          const etaMs =
            estimateGenerateSeconds(asset.targetSeconds || 4) * 1000;
          const expectedBeats = Math.max(
            1,
            Math.round((asset.targetSeconds || 4) / PRODUCT_PER_SHOT_SECONDS),
          );
          const parts = assets
            .filter((a) => {
              if (a.mode !== "sequence-part" || a.status !== "completed" || !a.url) {
                return false;
              }
              const pt = new Date(a.createdAt).getTime();
              return pt >= pendingAt - 5_000 && pt < pendingAt + 3 * 60 * 60 * 1000;
            })
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          const runningParts = assets.filter((a) => {
            if (a.mode !== "sequence-part" || a.status !== "running") return false;
            const pt = new Date(a.createdAt).getTime();
            return pt >= pendingAt - 5_000 && pt < pendingAt + 3 * 60 * 60 * 1000;
          });
          // Only force-deliver after full ETA (+1m) when nothing is still running.
          if (
            parts.length >= 1 &&
            runningParts.length === 0 &&
            ageMs > etaMs + 60_000
          ) {
            let delivered = false;
            if (parts.length >= 2) {
              try {
                const { concatVideos } = await import("@/lib/video-stitch");
                const concatUrl = await concatVideos(
                  parts.map((p) => p.url),
                  { maxSecondsPerClip: PRODUCT_PER_SHOT_SECONDS, clarity: true },
                );
                await updateAsset(asset.id, t.id, {
                  url: concatUrl,
                  status: "completed",
                  mode: "sequence-concat",
                  error:
                    parts.length < expectedBeats
                      ? `دُمجت ${parts.length}/${expectedBeats} لقطات بعد انتهاء المهلة`
                      : undefined,
                  hidden: false,
                  targetSeconds: parts.length * PRODUCT_PER_SHOT_SECONDS,
                });
                fixed += 1;
                delivered = true;
              } catch {
                // fall through to single
              }
            }
            if (!delivered) {
              const best = parts[0]!;
              let url = best.url;
              try {
                const { ensureClarityUrl } = await import("@/lib/ensure-clarity");
                url = await ensureClarityUrl(best.url);
              } catch {
                // keep
              }
              await updateAsset(asset.id, t.id, {
                url,
                historyId: best.historyId,
                status: "completed",
                mode: "sequence-concat",
                error:
                  parts.length < expectedBeats
                    ? `اكتملت ${parts.length} لقطة من ${expectedBeats} — عُرض المتاح`
                    : undefined,
                hidden: false,
                targetSeconds: parts.length * PRODUCT_PER_SHOT_SECONDS,
              });
              fixed += 1;
            }
          }
        }
      }
      const refreshed = await listAssetsForAdmin(t.id, 20);
      report.push({
        email: t.email,
        assets: assets.length,
        fixed,
        unhidden,
        rehiddenParts,
        sample: refreshed.slice(0, 12).map((a) => ({
          id: a.id,
          status: a.status,
          hidden: a.hidden,
          mode: a.mode,
          hasUrl: Boolean(a.url),
          historyId: a.historyId,
          createdAt: a.createdAt,
          error: a.error?.slice(0, 160),
          targetSeconds: a.targetSeconds,
        })),
      });
    }

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "repair failed" },
      { status: 500 },
    );
  }
}
