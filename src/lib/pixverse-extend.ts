/**
 * PixVerse long videos: two native 15s clips (last-frame continue), then concat.
 *
 * Disable with PIXVERSE_DURATION_EXTEND_ENABLED = false (UI cap returns to 15s).
 */

import {
  refundFailedAssetCredits,
  settlePartialGenerationCredits,
} from "@/lib/credit-refund";
import {
  findAssetByHistoryId,
  findAssetById,
  listAssetsForUser,
  updateAsset,
  type AssetRecord,
} from "@/lib/db";
import {
  PIXVERSE_DURATION_EXTEND_ENABLED,
  PIXVERSE_NATIVE_MAX_DURATION,
} from "@/lib/pixverse-constants";
import {
  createPixVerseExtendTask,
  createPixVerseFusionTask,
  createPixVerseVideoTask,
  getPixVerseVideoTask,
  mapPixVerseStatus,
  parsePixVerseHistoryId,
  pixVerseFailureMessage,
  toPixVerseHistoryId,
  uploadPixVerseImage,
  type PixVerseFusionImageRef,
} from "@/lib/pixverse";
import type { VisualReference } from "@/lib/types";
import {
  cacheVideoLocally,
  concatVideos,
} from "@/lib/video-stitch";
import { warmVideoPosterBackground } from "@/lib/poster-cache";

export const PIXVERSE_EXTEND_MODE = "pixverse-extend";
/** @deprecated Legacy verb-chain mode — kept for asset lookup only. */
export const PIXVERSE_VERB_CHAIN_MODE = "pixverse-verb-chain";

export type PixVerseExtendStage = "part1" | "part2" | "stitch";

export type PixVerseExtendJobMeta = {
  kind: "pixverse-extend";
  prompt: string;
  quality: string;
  aspectRatio?: string;
  generateAudio: boolean;
  durationSec: number;
  partDurations: [number, number];
  stage: PixVerseExtendStage;
  part1VideoId?: number;
  part1Url?: string;
  lastFrameUrl?: string;
  part2VideoId?: number;
  part2Url?: string;
  startFrameUrl?: string | null;
  actualSeconds?: number;
};

/** Legacy verb-chain job shape (fail gracefully on tick). */
type LegacyVerbChainMeta = {
  kind: "pixverse-verb-chain";
  partVideoIds?: number[];
};

export function isPixVerseExtendJobMeta(
  v: unknown,
): v is PixVerseExtendJobMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as PixVerseExtendJobMeta;
  return m.kind === "pixverse-extend" && Array.isArray(m.partDurations);
}

function isLegacyVerbChainMeta(v: unknown): v is LegacyVerbChainMeta {
  if (!v || typeof v !== "object") return false;
  return (v as LegacyVerbChainMeta).kind === "pixverse-verb-chain";
}

export function splitPixVerseDuration(requested?: number | null): number[] {
  const n = Math.max(1, Math.round(Number(requested) || 5));
  if (!PIXVERSE_DURATION_EXTEND_ENABLED || n <= PIXVERSE_NATIVE_MAX_DURATION) {
    return [Math.min(PIXVERSE_NATIVE_MAX_DURATION, n)];
  }
  const second = Math.min(
    PIXVERSE_NATIVE_MAX_DURATION,
    Math.max(1, n - PIXVERSE_NATIVE_MAX_DURATION),
  );
  return [PIXVERSE_NATIVE_MAX_DURATION, second];
}

export function needsPixVerseExtend(input: {
  duration?: number | null;
  hasVideoReferences?: boolean | null;
}): boolean {
  if (!PIXVERSE_DURATION_EXTEND_ENABLED) return false;
  if (input.hasVideoReferences) return false;
  return splitPixVerseDuration(input.duration).length > 1;
}

export function isPixVerseExtendAsset(asset: {
  jobMeta?: unknown;
  mode?: string | null;
  model?: string | null;
  targetSeconds?: number | null;
}): boolean {
  if (isPixVerseExtendJobMeta(asset.jobMeta)) return true;
  if (isLegacyVerbChainMeta(asset.jobMeta)) return true;
  if (
    asset.mode === PIXVERSE_EXTEND_MODE ||
    asset.mode === PIXVERSE_VERB_CHAIN_MODE
  ) {
    return true;
  }
  const model = String(asset.model || "").toLowerCase();
  return (
    model.includes("pixverse") &&
    Number(asset.targetSeconds || 0) > PIXVERSE_NATIVE_MAX_DURATION
  );
}

export function pixverseChainPollNote(meta: unknown): string {
  if (isLegacyVerbChainMeta(meta)) {
    return "جارٍ إنهاء توليد قديم — أعد التوليد إن توقف…";
  }
  if (!isPixVerseExtendJobMeta(meta)) return "جارٍ توليد PixVerse 15+15…";
  if (meta.stage === "part1") return "توليد المقطع الأول (15 ثانية)…";
  if (meta.stage === "part2") return "توليد المقطع الثاني (15 ثانية، استمرار من آخر إطار)…";
  return "دمج المقطعين…";
}

/** Resolve extend parent even when historyId points at part 2. */
export async function findPixVerseChainAsset(
  userId: string,
  historyId: string,
): Promise<AssetRecord | null> {
  const direct = await findAssetByHistoryId(userId, historyId);
  if (direct && isPixVerseExtendAsset(direct)) return direct;
  const pvId = parsePixVerseHistoryId(historyId);
  if (!pvId) return direct;
  const assets = await listAssetsForUser(userId, { includeHidden: true });
  const hit = assets.find((a) => {
    if (!isPixVerseExtendAsset(a)) return false;
    const meta: unknown = a.jobMeta;
    if (isPixVerseExtendJobMeta(meta)) {
      return meta.part1VideoId === pvId || meta.part2VideoId === pvId;
    }
    if (isLegacyVerbChainMeta(meta)) {
      return (meta.partVideoIds || []).some((id) => Number(id) === pvId);
    }
    return false;
  });
  return hit || direct;
}

function extendPrompt(prompt: string): string {
  const base = prompt.replace(/\n\nContinue the exact same shot[\s\S]*$/u, "").trim();
  const arabic = /[\u0600-\u06FF]/.test(base);
  if (arabic) {
    return `استمر في نفس المشهد. نفس الشخصيات والوجوه والملابس والمكان. تكملة الحركة.`;
  }
  return `Continue the same scene. Same characters, faces, clothing, and location. Continue the action.`;
}

async function buildFusionImages(
  refs: VisualReference[],
): Promise<PixVerseFusionImageRef[]> {
  const fusionImages: PixVerseFusionImageRef[] = [];
  for (let i = 0; i < Math.min(refs.length, 10); i++) {
    const r = refs[i]!;
    if (!r?.url) continue;
    const imgId = await uploadPixVerseImage(r, r.url);
    const rawName = r.label?.trim().replace(/^@+/, "") || `ref${i + 1}`;
    fusionImages.push({
      type: "subject",
      img_id: imgId,
      ref_name: rawName.slice(0, 24),
    });
  }
  return fusionImages;
}

export async function startPixVerseClip(input: {
  prompt: string;
  duration: number;
  quality: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  startFrameUrl?: string | null;
  characterRefs?: VisualReference[];
}): Promise<{ videoId: number }> {
  const duration = Math.min(
    PIXVERSE_NATIVE_MAX_DURATION,
    Math.max(1, Math.round(input.duration)),
  );
  const charRefs = (input.characterRefs || []).filter((r) => r?.url);
  const startUrl = input.startFrameUrl?.trim() || "";

  if (charRefs.length > 0 && !startUrl) {
    const fusionImages = await buildFusionImages(charRefs);
    return createPixVerseFusionTask({
      prompt: input.prompt,
      quality: input.quality,
      aspectRatio: input.aspectRatio,
      generateAudio: Boolean(input.generateAudio),
      imageReferences: fusionImages,
      duration,
    });
  }

  let imgId: number | undefined;
  if (startUrl) {
    imgId = await uploadPixVerseImage(
      { type: "image", id: "start", url: startUrl, label: "start" },
      startUrl,
    );
  }

  return createPixVerseVideoTask({
    prompt: input.prompt,
    duration,
    quality: input.quality,
    aspectRatio: input.aspectRatio,
    generateAudio: Boolean(input.generateAudio),
    imgId,
  });
}

const backgroundKeys = new Set<string>();
const tickLocks = new Map<string, Promise<AssetRecord | null>>();

export function ensurePixVerseExtendBackground(userId: string, assetId: string) {
  const key = `${userId}:${assetId}`;
  if (backgroundKeys.has(key)) return;
  backgroundKeys.add(key);
  void (async () => {
    const deadline = Date.now() + 90 * 60 * 1000;
    try {
      while (Date.now() < deadline) {
        const pending = await findAssetById(userId, assetId);
        if (!pending) break;
        if (pending.status !== "running") break;
        if (!isPixVerseExtendAsset(pending)) break;

        await tickPixVerseExtendJob(userId, pending);

        const after = await findAssetById(userId, assetId);
        if (!after || after.status !== "running") break;
        await new Promise((r) => setTimeout(r, 8_000));
      }
    } catch (err) {
      console.warn(
        "[veronix] pixverse-extend background failed:",
        err instanceof Error ? err.message : err,
      );
    } finally {
      backgroundKeys.delete(key);
    }
  })();
}

export async function tickUserPixVerseExtendJobs(userId: string) {
  const assets = await listAssetsForUser(userId, { includeHidden: true });
  const running = assets
    .filter((a) => a.status === "running" && isPixVerseExtendAsset(a))
    .slice(0, 3);
  for (const p of running) {
    ensurePixVerseExtendBackground(userId, p.id);
  }
}

export async function tickPixVerseExtendJob(
  userId: string,
  pending: AssetRecord,
): Promise<AssetRecord | null> {
  const lockKey = `${userId}:${pending.id}`;
  const prev = tickLocks.get(lockKey) || Promise.resolve(null);
  const next = prev
    .catch(() => null)
    .then(() => tickPixVerseExtendUnlocked(userId, pending));
  tickLocks.set(lockKey, next);
  try {
    return await next;
  } finally {
    if (tickLocks.get(lockKey) === next) tickLocks.delete(lockKey);
  }
}

async function failJob(
  userId: string,
  assetId: string,
  message: string,
): Promise<AssetRecord | null> {
  await updateAsset(assetId, userId, { status: "failed", error: message });
  await refundFailedAssetCredits({
    userId,
    assetId,
    errorMessage: message,
  });
  return findAssetById(userId, assetId);
}

async function deliverPartialPart1(
  userId: string,
  pending: AssetRecord,
  meta: PixVerseExtendJobMeta,
  part1Sec: number,
  reason: string,
): Promise<AssetRecord | null> {
  const url = meta.part1Url?.trim();
  if (!url) {
    return failJob(userId, pending.id, reason);
  }
  const charged = Math.max(0, Math.floor(Number(pending.creditsUsed) || 0));
  const keepCredits = Math.max(
    0,
    Math.round(charged * (part1Sec / Math.max(1, meta.durationSec))),
  );
  if (keepCredits < charged) {
    await settlePartialGenerationCredits({
      userId,
      assetId: pending.id,
      keepCredits,
    });
  }
  await updateAsset(pending.id, userId, {
    url,
    status: "completed",
    error: undefined,
    jobMeta: { ...meta, actualSeconds: part1Sec },
    hidden: false,
    mode: PIXVERSE_EXTEND_MODE,
    targetSeconds: part1Sec,
  });
  warmVideoPosterBackground({ url });
  console.info("[veronix] pixverse-extend partial part1", {
    assetId: pending.id,
    part1Sec,
    reason: reason.slice(0, 120),
  });
  return findAssetById(userId, pending.id);
}

async function tickPixVerseExtendUnlocked(
  userId: string,
  pendingIn: AssetRecord,
): Promise<AssetRecord | null> {
  const pending = (await findAssetById(userId, pendingIn.id)) || pendingIn;
  if (pending.status !== "running") return pending;

  if (isLegacyVerbChainMeta(pending.jobMeta)) {
    return failJob(
      userId,
      pending.id,
      "تم تحديث توليد 30 ثانية — أعد التوليد (15+15)",
    );
  }
  if (!isPixVerseExtendJobMeta(pending.jobMeta)) return pending;

  const meta: PixVerseExtendJobMeta = { ...pending.jobMeta };
  const [part1Sec, part2Sec] = meta.partDurations;
  const charRefs = Array.isArray(pending.referenceImages)
    ? pending.referenceImages
    : [];

  try {
    if (meta.stage === "part1") {
      if (!meta.part1VideoId) {
        const created = await startPixVerseClip({
          prompt: meta.prompt,
          duration: part1Sec,
          quality: meta.quality,
          aspectRatio: meta.aspectRatio,
          generateAudio: meta.generateAudio,
          startFrameUrl: meta.startFrameUrl,
          characterRefs: charRefs,
        });
        meta.part1VideoId = created.videoId;
        const historyId = toPixVerseHistoryId(created.videoId);
        await updateAsset(pending.id, userId, { jobMeta: meta, historyId });
        return (await findAssetById(userId, pending.id)) || pending;
      }

      const task = await getPixVerseVideoTask(meta.part1VideoId);
      const mapped = mapPixVerseStatus(task.status);
      if (mapped === "FAILED") {
        return failJob(userId, pending.id, pixVerseFailureMessage(task.status));
      }
      if (mapped !== "COMPLETED" || !task.url) return pending;

      const localUrl = await cacheVideoLocally(task.url, { clarity: false });
      // Use the official PixVerse extend API — passes source_video_id so
      // PixVerse itself preserves characters, faces, location, and lighting.
      const created2 = await createPixVerseExtendTask({
        sourceVideoId: meta.part1VideoId!,
        prompt: extendPrompt(meta.prompt),
        duration: part2Sec,
        quality: meta.quality,
        generateAudio: meta.generateAudio,
      });
      meta.stage = "part2";
      meta.part1Url = localUrl;
      meta.part2VideoId = created2.videoId;
      await updateAsset(pending.id, userId, {
        jobMeta: meta,
        historyId: toPixVerseHistoryId(created2.videoId),
        url: "",
      });
      return (await findAssetById(userId, pending.id)) || pending;
    }

    if (meta.stage === "part2") {
      if (!meta.part2VideoId) {
        return failJob(userId, pending.id, "PixVerse extend: missing part 2 id");
      }
      const task = await getPixVerseVideoTask(meta.part2VideoId);
      const mapped = mapPixVerseStatus(task.status);
      if (mapped === "FAILED") {
        return deliverPartialPart1(
          userId,
          pending,
          meta,
          part1Sec,
          pixVerseFailureMessage(task.status),
        );
      }
      if (mapped !== "COMPLETED" || !task.url) return pending;

      const localUrl = await cacheVideoLocally(task.url, { clarity: false });
      meta.part2Url = localUrl;
      meta.stage = "stitch";
      await updateAsset(pending.id, userId, { jobMeta: meta });
    }

    if (meta.stage === "stitch") {
      const urls = [meta.part1Url, meta.part2Url].filter(
        (u): u is string => Boolean(u),
      );
      if (urls.length < 2) {
        if (meta.part1Url) {
          return deliverPartialPart1(
            userId,
            pending,
            meta,
            part1Sec,
            "PixVerse extend: missing part 2 to stitch",
          );
        }
        return failJob(userId, pending.id, "PixVerse extend: missing clips to stitch");
      }
      const finalUrl = await concatVideos(urls, {
        maxSecondsPerClip: PIXVERSE_NATIVE_MAX_DURATION,
        maxTotalSeconds: meta.durationSec,
        clarity: false,
      });
      await updateAsset(pending.id, userId, {
        url: finalUrl,
        status: "completed",
        error: undefined,
        jobMeta: { ...meta, actualSeconds: meta.durationSec },
        hidden: false,
        mode: PIXVERSE_EXTEND_MODE,
        targetSeconds: meta.durationSec,
      });
      warmVideoPosterBackground({
        url: finalUrl,
        historyId: pending.historyId,
      });
      return findAssetById(userId, pending.id);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PixVerse extend failed";
    if (meta.part1Url && meta.stage !== "part1") {
      return deliverPartialPart1(userId, pending, meta, part1Sec, message);
    }
    return failJob(userId, pending.id, message);
  }

  return pending;
}
