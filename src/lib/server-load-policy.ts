/** Central toggles for keeping Railway CPU/RAM/bandwidth lean. */

export function serverFfmpegEnabled(): boolean {
  return process.env.SERVER_FFMPEG !== "0";
}

/** Routine `/api/assets?sync=1` — provider status only (default). */
export function syncIncludesHeavyPipeline(): boolean {
  return process.env.SYNC_HEAVY === "1";
}

/** Auto stitch multi-shot pending cards during sync (off by default). */
export function syncIncludesStitch(): boolean {
  return process.env.SYNC_AUTO_STITCH === "1" || syncIncludesHeavyPipeline();
}

/** Re-download timed-out provider clips during sync (off by default). */
export function syncIncludesRecover(): boolean {
  return process.env.SYNC_AUTO_RECOVER === "1" || syncIncludesHeavyPipeline();
}

/** Background outro/clarity during sync (off by default — use Edit export or opt-in). */
export function syncIncludesPostProcess(): boolean {
  return process.env.SYNC_POST_PROCESS === "1" || syncIncludesHeavyPipeline();
}
