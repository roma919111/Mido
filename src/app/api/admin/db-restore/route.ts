import { NextResponse } from "next/server";
import { findUserByEmail, listAssetsForAdmin, listUsersForAdmin, listRunningMultiShotJobs, updateAsset } from "@/lib/db";
import {
  currentDbStats,
  listDbBackups,
  mergeDbFromBackup,
  recoverDbFromBackupsIfNeeded,
} from "@/lib/db-backup";
import {
  ensureMultiShotBackground,
  isMultiShotJobMeta,
  tickMultiShotJob,
} from "@/lib/multi-shot-job";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  /** List live DB + backups (default). */
  action?:
    | "status"
    | "restore"
    | "auto"
    | "advance-multi"
    | "promote-finals"
    | "inspect"
    | "analyze-refs";
  email?: string;
  backupName?: string;
  fullReplace?: boolean;
  /** Optional explicit /generations paths to analyze */
  paths?: string[];
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

    if (action === "inspect") {
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }
      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      const assets = await listAssetsForAdmin(user.id, 12);
      return NextResponse.json({
        ok: true,
        email: user.email,
        credits: user.credits,
        assets: assets.map((a) => {
          const refs = Array.isArray(a.referenceImages) ? a.referenceImages : [];
          return {
            id: a.id,
            status: a.status,
            mode: a.mode,
            mediaType: a.mediaType,
            targetSeconds: a.targetSeconds,
            preferClarity: a.preferClarity === true,
            hasUrl: Boolean(a.url),
            urlPrefix: (a.url || "").slice(0, 64),
            historyId: a.historyId,
            createdAt: a.createdAt,
            prompt: (a.prompt || "").slice(0, 240),
            refCount: refs.length,
            refs: refs.map((r) => ({
              id: r.id,
              label: r.label,
              urlPrefix: (r.url || "").slice(0, 72),
              urlKind: (r.url || "").startsWith("data:")
                ? "data"
                : (r.url || "").startsWith("/generations/")
                  ? "generations"
                  : (r.url || "").startsWith("http")
                    ? "http"
                    : "other",
              urlLen: (r.url || "").length,
            })),
            error: a.error?.slice(0, 160),
          };
        }),
      });
    }

    if (action === "promote-finals") {
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }
      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      const assets = await listAssetsForAdmin(user.id, 200);
      let promoted = 0;
      for (const a of assets) {
        if (
          a.status === "completed" &&
          a.hidden !== true &&
          a.url &&
          (a.mode === "sequence-concat" || a.mediaType === "video")
        ) {
          // Touch to reorder to top (updateAsset promotes visible finals).
          await updateAsset(a.id, user.id, { hidden: false });
          promoted += 1;
          if (promoted >= 12) break;
        }
      }
      const refreshed = await listAssetsForAdmin(user.id, 15);
      return NextResponse.json({
        ok: true,
        promoted,
        sample: refreshed.map((a) => ({
          id: a.id,
          status: a.status,
          mode: a.mode,
          targetSeconds: a.targetSeconds,
          hasUrl: Boolean(a.url),
          hidden: a.hidden,
          error: a.error?.slice(0, 120),
        })),
      });
    }

    if (action === "advance-multi") {
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }
      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      const jobs = await listRunningMultiShotJobs(user.id);
      const report: Array<Record<string, unknown>> = [];
      for (const job of jobs.slice(0, 2)) {
        ensureMultiShotBackground(user.id, job.id);
        // Advance up to 3 beats in this request (each ~1m).
        let current = job;
        for (let i = 0; i < 3; i += 1) {
          if (current.status !== "running" || current.mode !== "sequence-pending") break;
          const next = await tickMultiShotJob(user.id, current);
          if (!next) break;
          current = next;
          if (current.status === "completed" || current.status === "failed") break;
        }
        report.push({
          id: current.id,
          status: current.status,
          mode: current.mode,
          targetSeconds: current.targetSeconds,
          nextIndex: isMultiShotJobMeta(current.jobMeta)
            ? current.jobMeta.nextIndex
            : null,
          partCount: isMultiShotJobMeta(current.jobMeta)
            ? current.jobMeta.partUrls.length
            : null,
          shotCount: isMultiShotJobMeta(current.jobMeta)
            ? current.jobMeta.shots.length
            : null,
          hasUrl: Boolean(current.url),
          error: current.error?.slice(0, 160),
        });
      }
      return NextResponse.json({ ok: true, report });
    }

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
