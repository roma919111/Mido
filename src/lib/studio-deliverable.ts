/**
 * When a video URL is safe to show in the studio player (before full disk persist).
 * Production LTX rental used to wait for full persist (~+30–40s vs HF Space alone).
 */

const LTX_DEPLOYED_HISTORY_PREFIX = "ltx25-deployed-";

export function isLtxDeployedHistoryId(historyId?: string | null): boolean {
  return String(historyId || "").startsWith(LTX_DEPLOYED_HISTORY_PREFIX);
}

/** True when the URL is already playable (HF Space, our stream proxy, or persisted file). */
export function isLtxFullPersistedVideoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.includes("/api/space/stream") || u.includes("/api/media/stream")) return true;
  if (/\.hf\.space/i.test(u) || /huggingface\.co/i.test(u)) return true;
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  if (/^https?:\/\//i.test(u) && !u.includes("blob:")) return true;
  return false;
}

export function assetHasDeliverableOutput(job: {
  status?: string;
  url?: string | null;
  historyId?: string | null;
}): boolean {
  const url = String(job.url || "").trim();
  if (!url) return false;
  const historyId = job.historyId || undefined;
  if (isLtxDeployedHistoryId(historyId)) {
    return isLtxFullPersistedVideoUrl(url);
  }
  return job.status === "completed" || job.status === "running";
}

/** Client poll interval for LTX deployed jobs (ms). */
export const LTX_DEPLOYED_STATUS_POLL_MS = 1200;
