/**
 * Wall-clock ETA for Veronix / Seedance generation.
 *
 * Measured on BytePlus: ~55s wall time for a 4s clip (often 55–70s under load).
 * Multi-shot adds per-beat cache/bridge + final concat/clarity.
 * Countdown must stay honest for 32s (8 beats ≈ 10–12 minutes) — never
 * flip to «يكتمل الآن» after only a couple of minutes.
 */

/** Conservative BytePlus wall time for a 4-second render (includes queue jitter). */
export const ETA_SECONDS_PER_4S_OUTPUT = 70;

/** Cache local copy + extract bridge frame between beats. */
export const ETA_SECONDS_PER_BEAT_OVERHEAD = 15;

/** Final ffmpeg concat + OmarFX clarity grade. */
export const ETA_SECONDS_FINAL_STITCH = 60;

/** Estimate total generate time (seconds) for a chosen output duration. */
export function estimateGenerateSeconds(outputDurationSec: number): number {
  const duration = Math.max(1, Math.round(outputDurationSec || 4));
  const beats = Math.max(1, Math.ceil(duration / 4));
  // N×70s BytePlus + N×15s cache/bridge + stitch/clarity
  return Math.max(
    40,
    Math.round(
      beats * ETA_SECONDS_PER_4S_OUTPUT +
        beats * ETA_SECONDS_PER_BEAT_OVERHEAD +
        (beats > 1 ? ETA_SECONDS_FINAL_STITCH : 25),
    ),
  );
}

/** Seconds remaining until the ETA (0 when overdue). */
export function remainingGenerateSeconds(
  startedAtMs: number,
  outputDurationSec: number,
  nowMs = Date.now(),
): number {
  const eta = estimateGenerateSeconds(outputDurationSec);
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
}): string {
  const {
    remainingSec,
    targetSeconds,
    partCount = 0,
    shotCount = 0,
    overdueForSec = 0,
  } = input;
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
