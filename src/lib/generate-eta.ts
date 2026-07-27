/**
 * Wall-clock ETA for Veronix / Seedance generation.
 * Measured: ~55s to finish a 4s clip on BytePlus — scale linearly by output length.
 */

/** Observed BytePlus wall time for a 4-second render. */
export const ETA_SECONDS_PER_4S_OUTPUT = 55;

/** Estimate total generate time (seconds) for a chosen output duration. */
export function estimateGenerateSeconds(outputDurationSec: number): number {
  const duration = Math.max(1, Math.round(outputDurationSec || 4));
  const beats = Math.max(1, Math.ceil(duration / 4));
  // ~55s per 4s beat on BytePlus + ~25s overhead (cache / bridge / stitch).
  return Math.max(20, Math.round(beats * ETA_SECONDS_PER_4S_OUTPUT + beats * 25));
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
  if (remainingSec <= 0) return "يكتمل الآن…";
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  if (m > 0) return `متبقي ${m}م ${s}ث`;
  return `متبقي ${s}ث`;
}

/** Overdue label after ETA — avoid endless "جاري الإنهاء" with no progress. */
export function formatRunningStatusLabel(
  remainingSec: number,
  overdueForSec: number,
): string {
  if (remainingSec > 0) return formatCountdownLabel(remainingSec);
  if (overdueForSec > 120) return "ما زال قيد المعالجة — حدّث الصفحة";
  return "يكتمل الآن…";
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
  // Keep map bounded
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
  return 4;
}
