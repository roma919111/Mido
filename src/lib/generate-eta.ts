/**
 * Wall-clock ETA for Veronix generation.
 *
 * Video (Seedance): ~55–70s wall time per ~4s of output under load.
 * Image (Seedream): ~30s measured on BytePlus for 2K stills.
 */

/** Conservative BytePlus wall time for a 4-second render (includes queue jitter). */
export const ETA_SECONDS_PER_4S_OUTPUT = 70;

/** Seedream 2K still — typical BytePlus wall clock. */
export const ETA_SECONDS_IMAGE = 30;

/** Cache local copy + extract bridge frame between beats. */
export const ETA_SECONDS_PER_BEAT_OVERHEAD = 15;

/** Final ffmpeg concat + OmarFX clarity grade. */
export const ETA_SECONDS_FINAL_STITCH = 60;

export type GenerateMediaKind = "image" | "video";

/** Estimate total generate time (seconds) for a chosen output duration / media. */
export function estimateGenerateSeconds(
  outputDurationSec: number,
  media: GenerateMediaKind = "video",
): number {
  if (media === "image") return ETA_SECONDS_IMAGE;
  const duration = Math.max(1, Math.round(outputDurationSec || 4));
  // Single clip: scale from the measured 4s wall time, then add clarity grade.
  const render = Math.ceil((duration / 4) * ETA_SECONDS_PER_4S_OUTPUT);
  return Math.max(45, render + 25);
}

/** Seconds remaining until the ETA (0 when overdue). */
export function remainingGenerateSeconds(
  startedAtMs: number,
  outputDurationSec: number,
  nowMs = Date.now(),
  media: GenerateMediaKind = "video",
): number {
  const eta = estimateGenerateSeconds(outputDurationSec, media);
  const elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  return Math.max(0, eta - elapsed);
}

export function formatCountdownLabel(remainingSec: number): string {
  if (remainingSec <= 0) return "ما زال قيد التوليد…";
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  if (m > 0) return `متبقي ${m}م ${s}ث`;
  return `متبقي ${s}ث`;
}

/**
 * Studio / Assets label that stays truthful for long 32s jobs.
 * Never implies the video is seconds away when we are only a few minutes in.
 */
export function formatStudioCountdownLabel(input: {
  remainingSec: number;
  targetSeconds: number;
  partCount?: number;
  shotCount?: number;
  overdueForSec?: number;
  media?: GenerateMediaKind;
}): string {
  const {
    remainingSec,
    targetSeconds,
    partCount = 0,
    shotCount = 0,
    overdueForSec = 0,
    media = "video",
  } = input;

  if (media === "image") {
    if (remainingSec > 0) return formatCountdownLabel(remainingSec);
    if (overdueForSec > 20) {
      return "ما زال قيد المعالجة — الصورة عادة جاهزة خلال ~30 ثانية";
    }
    return "ما زال قيد التوليد…";
  }

  const etaMin = Math.max(1, Math.ceil(estimateGenerateSeconds(targetSeconds) / 60));
  const progress =
    shotCount > 1
      ? `لقطة ${Math.min(shotCount, Math.max(1, partCount + (remainingSec <= 0 ? 0 : 1)))} من ${shotCount}`
      : null;

  if (remainingSec > 0) {
    const base = formatCountdownLabel(remainingSec);
    return progress ? `${progress} · ${base}` : base;
  }

  if (progress) {
    if (overdueForSec > 120) {
      return `${progress} · يستغرق عادة حتى ${etaMin} دقائق — تابع في Assets`;
    }
    return `${progress} · ما زال قيد التوليد (حتى ~${etaMin} دقائق)`;
  }

  if (overdueForSec > 180) {
    return `ما زال قيد المعالجة — فيديو ${targetSeconds}ث قد يستغرق حتى ${etaMin} دقائق`;
  }
  return `ما زال قيد التوليد — تقدير حتى ${etaMin} دقائق`;
}

/** Overdue label after ETA — avoid endless empty finishing state. */
export function formatRunningStatusLabel(
  remainingSec: number,
  overdueForSec: number,
): string {
  if (remainingSec > 0) return formatCountdownLabel(remainingSec);
  if (overdueForSec > 180) return "ما زال قيد المعالجة — حدّث Assets";
  return "ما زال قيد التوليد…";
}

/** Persist first-seen start times so Assets polls don't reset the countdown. */
const START_LOCK_KEY = "veronix.eta.startLock.v1";

export function lockEtaStart(assetId: string, createdAtIso?: string): number {
  if (typeof window === "undefined") {
    return createdAtIso ? new Date(createdAtIso).getTime() : Date.now();
  }
  let map: Record<string, number> = {};
  try {
    map = JSON.parse(sessionStorage.getItem(START_LOCK_KEY) || "{}") as Record<
      string,
      number
    >;
  } catch {
    map = {};
  }
  if (typeof map[assetId] === "number" && Number.isFinite(map[assetId])) {
    return map[assetId]!;
  }
  const started = createdAtIso ? new Date(createdAtIso).getTime() : Date.now();
  const safe = Number.isFinite(started) ? started : Date.now();
  map[assetId] = safe;
  const ids = Object.keys(map);
  if (ids.length > 40) {
    for (const id of ids.slice(0, ids.length - 40)) delete map[id];
  }
  try {
    sessionStorage.setItem(START_LOCK_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  return safe;
}

export function clearEtaStart(assetId: string) {
  if (typeof window === "undefined") return;
  try {
    const map = JSON.parse(sessionStorage.getItem(START_LOCK_KEY) || "{}") as Record<
      string,
      number
    >;
    delete map[assetId];
    sessionStorage.setItem(START_LOCK_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Infer output seconds from pending prompt tag or default 4. */
export function inferTargetSecondsFromAsset(asset: {
  mode?: string;
  prompt?: string;
  targetSeconds?: number;
}): number {
  if (typeof asset.targetSeconds === "number" && asset.targetSeconds > 0) {
    return asset.targetSeconds;
  }
  const m = /دمج\s+(\d+)\s+لقطات/u.exec(asset.prompt || "");
  if (m) {
    const shots = Number(m[1]);
    if (Number.isFinite(shots) && shots > 0) return shots * 4;
  }
  const m2 = /(\d+)\s*ث/u.exec(asset.prompt || "");
  if (m2) {
    const sec = Number(m2[1]);
    if (Number.isFinite(sec) && sec >= 4) return sec;
  }
  return 4;
}
