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
          asset.status === "running" &&
          !asset.url
        ) {
          const parts = assets
            .filter(
              (a) =>
                a.mode === "sequence-part" &&
                a.status === "completed" &&
                Boolean(a.url),
            )
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          // Only auto-promote a single part when the job was meant to be 4s.
          const expected = Math.max(1, Math.round((asset.targetSeconds || 4) / 4));
          if (parts.length === 1 && expected <= 1 && parts[0]?.url) {
            await updateAsset(asset.id, t.id, {
              url: parts[0].url,
              historyId: parts[0].historyId,
              status: "completed",
              mode: "sequence-concat",
              error: undefined,
              hidden: false,
              targetSeconds: 4,
            });
            fixed += 1;
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
