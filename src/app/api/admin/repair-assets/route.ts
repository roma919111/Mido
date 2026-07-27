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
      const assets = await listAssetsForAdmin(t.id, 80);
      let fixed = 0;
      let unhidden = 0;
      for (const asset of assets) {
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
                hidden: false,
              });
              fixed += 1;
            } else if (status === "FAILED") {
              await updateAsset(asset.id, t.id, {
                status: "failed",
                error:
                  typeof task.error === "string"
                    ? task.error
                    : "BytePlus generation failed",
                hidden: false,
              });
              fixed += 1;
            }
          } catch {
            // skip
          }
        } else if (
          asset.hidden === true &&
          asset.status === "completed" &&
          asset.url
        ) {
          await updateAsset(asset.id, t.id, { hidden: false });
          unhidden += 1;
        } else if (
          asset.mode === "sequence-pending" &&
          asset.status === "running" &&
          !asset.url
        ) {
          const part = assets.find(
            (a) =>
              a.mode === "sequence-part" &&
              a.status === "completed" &&
              Boolean(a.url),
          );
          if (part?.url) {
            await updateAsset(asset.id, t.id, {
              url: part.url,
              historyId: part.historyId,
              status: "completed",
              mode: "sequence-concat",
              error: undefined,
              hidden: false,
            });
            fixed += 1;
          }
        }
      }
      report.push({
        email: t.email,
        assets: assets.length,
        fixed,
        unhidden,
        sample: assets.slice(0, 8).map((a) => ({
          id: a.id,
          status: a.status,
          hidden: a.hidden,
          mode: a.mode,
          hasUrl: Boolean(a.url),
          historyId: a.historyId,
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
