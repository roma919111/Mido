/**
 * Server-side multi-shot job runner.
 * Plans N×4s beats for the chosen duration, generates each on BytePlus,
 * then stitches + clarity-grades into one final Assets video.
 *
 * Jobs keep running in-process after the HTTP response so a 32s (8×4s)
 * render can finish even if the browser leaves Create / Assets.
 */

import {
  createBytePlusVideoTask,
  getBytePlusVideoTask,
  isBytePlusConfigured,
  mapBytePlusStatus,
  toBytePlusHistoryId,
  waitForBytePlusVideoTask,
} from "@/lib/byteplus-ark";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import {
  adjustCredits,
  createAsset,
  findAssetById,
  findUserById,
  listRunningMultiShotJobs,
  updateAsset,
  type AssetRecord,
} from "@/lib/db";
import { expandShotsToBudget, shotBudgetFromDuration } from "@/lib/expand-shots";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import { toSemiRealisticScenePrompt } from "@/lib/reference-sanitize";
import { stylizeReferenceImage } from "@/lib/reference-sanitize";
import { MAX_SHOTS, PRODUCT_PER_SHOT_SECONDS } from "@/lib/shot-plan";
import { cacheVideoLocally, concatVideos, extractLastFrameJpeg } from "@/lib/video-stitch";
import { ensureClarityUrl } from "@/lib/ensure-clarity";
import { estimateGenerateSeconds } from "@/lib/generate-eta";

export type MultiShotBeat = { prompt: string; action: string };

export type MultiShotJobMeta = {
  kind: "multi-shot";
  shots: MultiShotBeat[];
  nextIndex: number;
  partUrls: string[];
  partAssetIds: string[];
  bridgeFrameUrl?: string | null;
  startFrameUrl?: string | null;
  resolution?: string;
  generateAudio?: boolean;
  perShotSeconds: number;
  targetSeconds: number;
};

export function isMultiShotJobMeta(v: unknown): v is MultiShotJobMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as MultiShotJobMeta;
  return m.kind === "multi-shot" && Array.isArray(m.shots);
}

/** True while a multi-shot job still has planned beats left (within ETA). */
export function isMultiShotStillGenerating(asset: AssetRecord, nowMs = Date.now()): boolean {
  if (asset.mode !== "sequence-pending" || asset.status !== "running") return false;
  if (!isMultiShotJobMeta(asset.jobMeta)) return false;
  if (asset.jobMeta.nextIndex >= asset.jobMeta.shots.length) return false;
  const ageMs = nowMs - new Date(asset.createdAt).getTime();
  const etaMs = estimateGenerateSeconds(asset.targetSeconds || asset.jobMeta.targetSeconds) * 1000;
  // Soft grace past ETA so the last beat/stitch can finish.
  return ageMs < etaMs + 3 * 60_000;
}

async function saveBridgeJpeg(buf: Buffer): Promise<string> {
  // Prefer data URL so BytePlus can ingest without a public fetch.
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/**
 * Create the visible pending card + job plan. Credits are charged per beat on tick.
 */
export async function startMultiShotJob(input: {
  userId: string;
  prompt: string;
  shots: MultiShotBeat[];
  durationSec: number;
  startFrameUrl?: string | null;
  resolution?: string;
  generateAudio?: boolean;
}): Promise<AssetRecord> {
  const budget = shotBudgetFromDuration(input.durationSec, MAX_SHOTS);
  const shots = expandShotsToBudget(input.shots, budget);
  const targetSeconds = shots.length * PRODUCT_PER_SHOT_SECONDS;
  const meta: MultiShotJobMeta = {
    kind: "multi-shot",
    shots,
    nextIndex: 0,
    partUrls: [],
    partAssetIds: [],
    bridgeFrameUrl: null,
    startFrameUrl: input.startFrameUrl || null,
    resolution: input.resolution || "720p",
    generateAudio: Boolean(input.generateAudio),
    perShotSeconds: PRODUCT_PER_SHOT_SECONDS,
    targetSeconds,
  };

  return createAsset({
    userId: input.userId,
    mediaType: "video",
    url: "",
    prompt: `${input.prompt.trim()}\n\n(جارٍ توليد ودمج ${shots.length} لقطات… ${targetSeconds}ث)`,
    mode: "sequence-pending",
    model: VERONIX_MODEL_ID,
    creditsUsed: 0,
    status: "running",
    hidden: false,
    targetSeconds,
    jobMeta: meta,
  });
}

const backgroundKeys = new Set<string>();
const tickLocks = new Map<string, Promise<AssetRecord | null>>();

/**
 * Keep generating beats in the Node process after the HTTP response.
 * Safe to call repeatedly — deduped per asset.
 */
export function ensureMultiShotBackground(userId: string, assetId: string) {
  const key = `${userId}:${assetId}`;
  if (backgroundKeys.has(key)) return;
  backgroundKeys.add(key);
  void (async () => {
    try {
      // 8 beats × ~70s + stitch — stay under a generous in-process budget.
      for (let step = 0; step < 16; step += 1) {
        const pending = await findAssetById(userId, assetId);
        if (!pending) break;
        if (pending.mode !== "sequence-pending" || pending.status !== "running") break;
        if (!isMultiShotJobMeta(pending.jobMeta)) break;

        await tickMultiShotJob(userId, pending);

        const after = await findAssetById(userId, assetId);
        if (!after || after.status !== "running" || after.mode !== "sequence-pending") break;
        if (
          isMultiShotJobMeta(after.jobMeta) &&
          after.jobMeta.nextIndex >= after.jobMeta.shots.length
        ) {
          break;
        }
      }
    } catch (err) {
      console.warn(
        "[veronix] multi-shot background failed:",
        err instanceof Error ? err.message : err,
      );
    } finally {
      backgroundKeys.delete(key);
    }
  })();
}

/** Tick all running multi-shot jobs for a user (kick / resume background runners). */
export async function tickUserMultiShotJobs(userId: string, _assets?: AssetRecord[]) {
  const pendings = (await listRunningMultiShotJobs(userId)).slice(0, 3);
  for (const p of pendings) {
    ensureMultiShotBackground(userId, p.id);
  }
}

/**
 * Advance one beat (or finalize stitch). Safe to call repeatedly.
 * Resumes an in-flight part instead of spawning duplicates.
 */
export async function tickMultiShotJob(
  userId: string,
  pending: AssetRecord,
): Promise<AssetRecord | null> {
  const lockKey = `${userId}:${pending.id}`;
  const prev = tickLocks.get(lockKey) || Promise.resolve(null);
  const next = prev
    .catch(() => null)
    .then(() => tickMultiShotJobUnlocked(userId, pending));
  tickLocks.set(lockKey, next);
  try {
    return await next;
  } finally {
    if (tickLocks.get(lockKey) === next) tickLocks.delete(lockKey);
  }
}

async function tickMultiShotJobUnlocked(
  userId: string,
  pendingIn: AssetRecord,
): Promise<AssetRecord | null> {
  // Re-read latest job state under the lock.
  const pending = (await findAssetById(userId, pendingIn.id)) || pendingIn;

  if (pending.mode !== "sequence-pending" || pending.status !== "running") {
    return pending;
  }
  if (!isMultiShotJobMeta(pending.jobMeta)) return pending;
  if (!isBytePlusConfigured()) {
    await updateAsset(pending.id, userId, {
      status: "failed",
      error: "BytePlus غير مُعدّ على السيرفر",
    });
    return null;
  }

  const meta: MultiShotJobMeta = {
    ...pending.jobMeta,
    partUrls: [...pending.jobMeta.partUrls],
    partAssetIds: [...pending.jobMeta.partAssetIds],
  };

  // All beats attempted → stitch whatever we have.
  if (meta.nextIndex >= meta.shots.length) {
    return finalizeMultiShotJob(userId, pending, meta);
  }

  // Resume existing part for this beat if present.
  const existingPartId = meta.partAssetIds[meta.nextIndex];
  if (existingPartId) {
    const part = await findAssetById(userId, existingPartId);
    if (part?.status === "completed" && part.url) {
      return adoptCompletedPart(userId, pending, meta, part);
    }
    if (part?.status === "running" && part.historyId) {
      return resumeRunningPart(userId, pending, meta, part);
    }
    // Failed / missing — skip this slot and continue.
    meta.nextIndex += 1;
    meta.bridgeFrameUrl = null;
    await updateAsset(pending.id, userId, { jobMeta: meta });
    if (meta.nextIndex >= meta.shots.length) {
      return finalizeMultiShotJob(userId, pending, meta);
    }
    // Fall through to start the next beat in this same tick.
  }

  const shot = meta.shots[meta.nextIndex]!;
  const label = `لقطة ${meta.nextIndex + 1}/${meta.shots.length}`;

  const quote = await quoteOpenArtCredits(
    {
      modelId: VERONIX_MODEL_ID,
      media: "video",
      mode: meta.startFrameUrl || meta.bridgeFrameUrl ? "image2video" : "text2video",
      duration: meta.perShotSeconds,
      resolution: meta.resolution,
      generateAudio: meta.generateAudio,
    },
    { allowCache: true },
  );
  if (!quote.available) {
    await updateAsset(pending.id, userId, {
      status: "failed",
      error: "الموديل غير متاح للتوليد حالياً",
      jobMeta: meta,
    });
    return null;
  }

  const user = await findUserById(userId);
  if (!user || user.credits < quote.totalCredits) {
    if (meta.partUrls.length >= 1) {
      return finalizeMultiShotJob(userId, pending, meta);
    }
    await updateAsset(pending.id, userId, {
      status: "failed",
      error: "رصيد غير كافٍ لإكمال باقي اللقطات",
      jobMeta: meta,
    });
    return null;
  }
  if (quote.totalCredits > 0) {
    await adjustCredits(userId, -quote.totalCredits);
  }

  const part = await createAsset({
    userId,
    mediaType: "video",
    url: "",
    prompt: shot.prompt,
    mode: "sequence-part",
    model: VERONIX_MODEL_ID,
    creditsUsed: quote.totalCredits,
    status: "running",
    hidden: true,
    targetSeconds: meta.perShotSeconds,
  });
  meta.partAssetIds[meta.nextIndex] = part.id;
  await updateAsset(pending.id, userId, { jobMeta: meta });

  let frameUrl = meta.nextIndex === 0 ? meta.startFrameUrl : meta.bridgeFrameUrl;

  try {
    if (frameUrl && !frameUrl.startsWith("data:")) {
      try {
        frameUrl = await stylizeReferenceImage(frameUrl);
      } catch {
        // keep original
      }
    }

    const createInput = {
      prompt: shot.prompt,
      duration: meta.perShotSeconds,
      ratio: "16:9" as const,
      generateAudio: Boolean(meta.generateAudio),
      watermark: false,
      startFrameUrl: frameUrl || null,
      imageRole: "first_frame" as const,
      resolution: meta.resolution,
    };

    let created;
    try {
      created = await createBytePlusVideoTask(createInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/InputImageSensitive|PrivacyInformation|real person/i.test(msg) && frameUrl) {
        created = await createBytePlusVideoTask({
          ...createInput,
          prompt: toSemiRealisticScenePrompt(shot.prompt),
          startFrameUrl: null,
          generateAudio: false,
        });
      } else {
        throw err;
      }
    }

    const historyId = toBytePlusHistoryId(created.id);
    await updateAsset(part.id, userId, { historyId, status: "running" });

    const finished = await waitForBytePlusVideoTask(created.id, {
      timeoutMs: 100_000,
      intervalMs: 4_000,
      retryInput: {
        ...createInput,
        prompt: toSemiRealisticScenePrompt(shot.prompt),
      },
    });
    const videoUrl = finished.content?.video_url || "";
    const st = mapBytePlusStatus(finished.status);

    if (!videoUrl) {
      await updateAsset(part.id, userId, {
        status: "failed",
        error: st === "FAILED" ? "BytePlus generation failed" : "timeout",
        hidden: true,
      });
      if (quote.totalCredits > 0) await adjustCredits(userId, quote.totalCredits);
      meta.nextIndex += 1;
      meta.bridgeFrameUrl = null;
      await updateAsset(pending.id, userId, {
        jobMeta: meta,
        error: `تخطّي ${label}`,
      });
      if (meta.nextIndex >= meta.shots.length) {
        return finalizeMultiShotJob(userId, pending, meta);
      }
      return (await updateAsset(pending.id, userId, { jobMeta: meta })) || pending;
    }

    const localUrl = await cacheVideoLocally(videoUrl, { clarity: false });
    await updateAsset(part.id, userId, {
      historyId: finished.id ? toBytePlusHistoryId(finished.id) : historyId,
      url: localUrl,
      status: "completed",
      hidden: true,
    });
    return adoptCompletedPart(
      userId,
      {
        ...pending,
        creditsUsed: (pending.creditsUsed || 0) + quote.totalCredits,
      },
      meta,
      { ...part, url: localUrl, status: "completed" },
      quote.totalCredits,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل توليد اللقطة";
    await updateAsset(part.id, userId, {
      status: "failed",
      error: message,
      hidden: true,
    });
    if (quote.totalCredits > 0) {
      await adjustCredits(userId, quote.totalCredits).catch(() => undefined);
    }
    meta.nextIndex += 1;
    meta.bridgeFrameUrl = null;
    await updateAsset(pending.id, userId, {
      jobMeta: meta,
      error: `${label}: ${message}`,
    });
    if (meta.nextIndex >= meta.shots.length) {
      return finalizeMultiShotJob(userId, pending, meta);
    }
    return (await updateAsset(pending.id, userId, { jobMeta: meta })) || pending;
  }
}

async function resumeRunningPart(
  userId: string,
  pending: AssetRecord,
  meta: MultiShotJobMeta,
  part: AssetRecord,
): Promise<AssetRecord | null> {
  const bpId = part.historyId?.startsWith("bp:")
    ? part.historyId.slice(3)
    : null;
  if (!bpId) {
    meta.nextIndex += 1;
    await updateAsset(pending.id, userId, { jobMeta: meta });
    return pending;
  }

  try {
    const finished = await waitForBytePlusVideoTask(bpId, {
      timeoutMs: 100_000,
      intervalMs: 4_000,
    });
    const videoUrl = finished.content?.video_url || "";
    if (!videoUrl) {
      const task = await getBytePlusVideoTask(bpId);
      if (mapBytePlusStatus(task.status) === "FAILED") {
        await updateAsset(part.id, userId, {
          status: "failed",
          error: "BytePlus generation failed",
          hidden: true,
        });
        meta.nextIndex += 1;
        meta.bridgeFrameUrl = null;
        await updateAsset(pending.id, userId, { jobMeta: meta });
        if (meta.nextIndex >= meta.shots.length) {
          return finalizeMultiShotJob(userId, pending, meta);
        }
      }
      return pending;
    }
    const localUrl = await cacheVideoLocally(videoUrl, { clarity: false });
    await updateAsset(part.id, userId, {
      url: localUrl,
      status: "completed",
      hidden: true,
    });
    return adoptCompletedPart(userId, pending, meta, {
      ...part,
      url: localUrl,
      status: "completed",
    });
  } catch {
    return pending;
  }
}

async function adoptCompletedPart(
  userId: string,
  pending: AssetRecord,
  meta: MultiShotJobMeta,
  part: AssetRecord,
  addedCredits = 0,
): Promise<AssetRecord | null> {
  const url = part.url;
  if (!url) return pending;

  // Count this beat once — partUrls.length tracks completed beats in order.
  if (meta.partUrls.length === meta.nextIndex && !meta.partUrls.includes(url)) {
    meta.partUrls.push(url);
  } else if (!meta.partUrls.includes(url) && meta.partUrls.length < meta.nextIndex) {
    meta.partUrls.push(url);
  }
  meta.nextIndex = Math.max(meta.nextIndex, meta.partUrls.length);

  if (meta.nextIndex < meta.shots.length) {
    try {
      const jpeg = await extractLastFrameJpeg(url);
      meta.bridgeFrameUrl = await saveBridgeJpeg(jpeg);
    } catch {
      meta.bridgeFrameUrl = null;
    }
  }

  const creditsUsed = (pending.creditsUsed || 0) + addedCredits;
  await updateAsset(pending.id, userId, {
    jobMeta: meta,
    error: undefined,
    creditsUsed,
  });

  if (meta.nextIndex >= meta.shots.length) {
    return finalizeMultiShotJob(
      userId,
      { ...pending, creditsUsed },
      meta,
    );
  }
  return (await updateAsset(pending.id, userId, { jobMeta: meta, creditsUsed })) || pending;
}

async function finalizeMultiShotJob(
  userId: string,
  pending: AssetRecord,
  meta: MultiShotJobMeta,
): Promise<AssetRecord | null> {
  if (meta.partUrls.length === 0) {
    return updateAsset(pending.id, userId, {
      status: "failed",
      error: "لم تكتمل أي لقطة — أعد التوليد",
      jobMeta: meta,
    });
  }

  try {
    let finalUrl: string;
    if (meta.partUrls.length === 1) {
      finalUrl = await ensureClarityUrl(meta.partUrls[0]!);
    } else {
      finalUrl = await concatVideos(meta.partUrls, {
        maxSecondsPerClip: meta.perShotSeconds,
        clarity: true,
      });
    }
    const actualSeconds = meta.partUrls.length * meta.perShotSeconds;
    const planned = meta.targetSeconds || meta.shots.length * meta.perShotSeconds;
    return updateAsset(pending.id, userId, {
      url: finalUrl,
      status: "completed",
      mode: "sequence-concat",
      error:
        meta.partUrls.length < meta.shots.length
          ? `دُمجت ${meta.partUrls.length}/${meta.shots.length} لقطات (${actualSeconds}ث من ${planned}ث)`
          : undefined,
      hidden: false,
      // Honest delivered length — never claim 32s for a shorter concat.
      targetSeconds: actualSeconds,
      jobMeta: { ...meta, nextIndex: meta.shots.length },
    });
  } catch (err) {
    return updateAsset(pending.id, userId, {
      status: "failed",
      error: err instanceof Error ? err.message : "تعذر دمج اللقطات",
      jobMeta: meta,
    });
  }
}
