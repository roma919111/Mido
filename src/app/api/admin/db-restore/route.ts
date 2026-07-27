import { NextResponse } from "next/server";
import { findUserByEmail, listAssetsForAdmin, listUsersForAdmin, listRunningMultiShotJobs } from "@/lib/db";
import {
  currentDbStats,
  listDbBackups,
  mergeDbFromBackup,
  recoverDbFromBackupsIfNeeded,
} from "@/lib/db-backup";
import { ensureMultiShotBackground, isMultiShotJobMeta } from "@/lib/multi-shot-job";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  /** List live DB + backups (default). */
  action?: "status" | "restore" | "auto";
  email?: string;
  backupName?: string;
  fullReplace?: boolean;
};

/**
 * Ops: inspect / restore customer DB from volume backups.
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
    const action = body.action || "status";

    if (action === "auto") {
      const recovered = await recoverDbFromBackupsIfNeeded();
      const stats = await currentDbStats();
      return NextResponse.json({ ok: true, recovered, stats });
    }

    if (action === "restore") {
      const result = await mergeDbFromBackup({
        email: body.email,
        backupName: body.backupName,
        fullReplace: Boolean(body.fullReplace),
      });
      const stats = await currentDbStats();
      let userReport: Record<string, unknown> | null = null;
      if (body.email) {
        const user = await findUserByEmail(body.email.trim().toLowerCase());
        if (user) {
          const assets = await listAssetsForAdmin(user.id, 40);
          userReport = {
            email: user.email,
            credits: user.credits,
            planId: user.planId,
            assets: assets.length,
            sample: assets.slice(0, 12).map((a) => ({
              id: a.id,
              status: a.status,
              mode: a.mode,
              hidden: a.hidden,
              hasUrl: Boolean(a.url),
              targetSeconds: a.targetSeconds,
              createdAt: a.createdAt,
            })),
          };
        }
      }
      return NextResponse.json({ ok: result.ok, result, stats, user: userReport });
    }

    const stats = await currentDbStats();
    const backups = await listDbBackups();
    const users = await listUsersForAdmin();
    const pendingJobs: Array<Record<string, unknown>> = [];
    for (const u of users.slice(0, 20)) {
      const full = await findUserByEmail(u.email);
      if (!full) continue;
      const running = await listRunningMultiShotJobs(full.id);
      for (const job of running) {
        ensureMultiShotBackground(full.id, job.id);
        pendingJobs.push({
          email: u.email,
          id: job.id,
          targetSeconds: job.targetSeconds,
          nextIndex: isMultiShotJobMeta(job.jobMeta) ? job.jobMeta.nextIndex : null,
          shotCount: isMultiShotJobMeta(job.jobMeta) ? job.jobMeta.shots.length : null,
          partCount: isMultiShotJobMeta(job.jobMeta) ? job.jobMeta.partUrls.length : null,
          createdAt: job.createdAt,
          error: job.error?.slice(0, 120),
        });
      }
    }
    return NextResponse.json({
      ok: true,
      stats,
      users,
      pendingJobs,
      backups: backups.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "db restore failed" },
      { status: 500 },
    );
  }
}
