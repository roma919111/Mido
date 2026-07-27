import { NextResponse } from "next/server";
import {
  getBytePlusVideoTask,
  mapBytePlusStatus,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import {
  findUserByEmail,
  listAssetsForAdmin,
  listUsersForAdmin,
  recoverStuckSequencePending,
  updateAsset,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

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
      let fixed = 0;
      let unhidden = 0;
      let rehiddenParts = 0;
      for (const asset of assets) {
        // Intermediate beats must stay hidden forever.
        if (asset.mode === "sequence-part" && asset.hidden !== true) {
          await updateAsset(asset.id, t.id, { hidden: true });
          rehiddenParts += 1;
        }
        const bpId = parseBytePlusHistoryId(asset.historyId || "");
        if (bpId && (asset.status === "running" || !asset.url)) {
          try {
            const task = await getBytePlusVideoTask(bpId);
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
          const pendingAt = new Date(asset.createdAt).getTime();
          const ageMs = Date.now() - pendingAt;
          const parts = assets
            .filter((a) => {
              if (a.mode !== "sequence-part" || a.status !== "completed" || !a.url) {
                return false;
              }
              const t = new Date(a.createdAt).getTime();
              return t >= pendingAt - 5_000 && t < pendingAt + 3 * 60 * 60 * 1000;
            })
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          const runningParts = assets.filter((a) => {
            if (a.mode !== "sequence-part" || a.status !== "running") return false;
            const t = new Date(a.createdAt).getTime();
            return t >= pendingAt - 5_000 && t < pendingAt + 3 * 60 * 60 * 1000;
          });
          // Force-deliver after 3 minutes if beats exist and nothing is still running.
          if (parts.length >= 1 && runningParts.length === 0 && ageMs > 3 * 60 * 1000) {
            let delivered = false;
            if (parts.length >= 2) {
              try {
                const { concatVideos } = await import("@/lib/video-stitch");
                const { PRODUCT_PER_SHOT_SECONDS } = await import("@/lib/shot-plan");
                const concatUrl = await concatVideos(
                  parts.map((p) => p.url),
                  { maxSecondsPerClip: PRODUCT_PER_SHOT_SECONDS, clarity: true },
                );
                await updateAsset(asset.id, t.id, {
                  url: concatUrl,
                  status: "completed",
                  mode: "sequence-concat",
                  error: undefined,
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
                  parts.length < Math.max(1, Math.round((asset.targetSeconds || 4) / 4))
                    ? `اكتملت ${parts.length} لقطة — عُرض المتاح`
                    : undefined,
                hidden: false,
                targetSeconds: parts.length * 4,
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
