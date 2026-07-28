import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { findAssetById } from "@/lib/db";
import {
  ensureMultiShotBackground,
  startMultiShotJob,
  tickMultiShotJob,
  type MultiShotBeat,
} from "@/lib/multi-shot-job";
import { expandShotsToBudget, shotBudgetFromDuration } from "@/lib/expand-shots";
import { MAX_SHOTS, PRODUCT_PER_SHOT_SECONDS } from "@/lib/shot-plan";
import { estimateGenerateSeconds } from "@/lib/generate-eta";
import { ensureBytePlusRefUrl } from "@/lib/byteplus-ark";

export const runtime = "nodejs";
export const maxDuration = 300;

type StartBody = {
  action?: "start" | "tick" | "status";
  assetId?: string;
  prompt?: string;
  shots?: MultiShotBeat[];
  duration?: number;
  resolution?: string;
  generateAudio?: boolean;
  startFrame?: import("@/lib/types").VisualReference | null;
};

/**
 * Server-side multi-shot: start a job, poll status, or tick the next beat.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Login required", needsAuth: true },
        { status: 401 },
      );
    }

    const body = (await request.json()) as StartBody;
    const action = body.action || "start";

    if (action === "status" || action === "tick") {
      const assetId = body.assetId?.trim();
      if (!assetId) {
        return NextResponse.json({ error: "assetId required" }, { status: 400 });
      }
      const pending = await findAssetById(user.id, assetId);
      if (!pending) {
        return NextResponse.json({ error: "job not found" }, { status: 404 });
      }

      // Always (re)attach the in-process runner so 32s jobs keep moving
      // even if the previous deploy / request died mid-beat.
      if (pending.status === "running" && pending.mode === "sequence-pending") {
        ensureMultiShotBackground(user.id, pending.id);
      }

      let updated = pending;
      // "tick" advances one beat in this request; "status" only reports + kicks BG.
      if (action === "tick" && pending.status === "running") {
        updated = (await tickMultiShotJob(user.id, pending)) || pending;
      } else {
        // Re-read after kick in case BG already finished a beat.
        updated = (await findAssetById(user.id, assetId)) || pending;
      }

      const meta = updated.jobMeta;
      return NextResponse.json({
        asset: updated,
        done: updated.status === "completed" || updated.status === "failed",
        nextIndex: meta?.nextIndex ?? 0,
        shotCount: meta?.shots?.length ?? 0,
        partCount: meta?.partUrls?.length ?? 0,
        estimatedSeconds: estimateGenerateSeconds(
          updated.targetSeconds || meta?.targetSeconds || 4,
        ),
      });
    }

    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    const duration =
      typeof body.duration === "number" && body.duration > 0
        ? body.duration
        : PRODUCT_PER_SHOT_SECONDS * 2;
    const budget = shotBudgetFromDuration(duration, MAX_SHOTS);
    let shots = Array.isArray(body.shots)
      ? body.shots.filter((s) => s?.prompt?.trim())
      : [];
    if (shots.length < 2) {
      shots = Array.from({ length: budget }, (_, i) => ({
        action: `beat ${i + 1}`,
        prompt: `${prompt}\n\nBeat ${i + 1} of ${budget}. one shot only.`,
      }));
    }
    shots = expandShotsToBudget(shots, budget);

    const startFrameUrl = await ensureBytePlusRefUrl(body.startFrame || null);

    const asset = await startMultiShotJob({
      userId: user.id,
      prompt,
      shots,
      durationSec: duration,
      startFrameUrl,
      resolution: body.resolution || "720p",
      generateAudio: Boolean(body.generateAudio),
    });

    // Continue all beats in the Node process after the response — required for
    // 32s (8×4s ≈ 9m) so the job does not die when the browser leaves.
    after(() => {
      ensureMultiShotBackground(user.id, asset.id);
    });
    ensureMultiShotBackground(user.id, asset.id);

    return NextResponse.json({
      asset,
      shotCount: shots.length,
      targetSeconds: shots.length * PRODUCT_PER_SHOT_SECONDS,
      started: true,
      estimatedSeconds: estimateGenerateSeconds(
        shots.length * PRODUCT_PER_SHOT_SECONDS,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "multi-shot job failed",
      },
      { status: 500 },
    );
  }
}
