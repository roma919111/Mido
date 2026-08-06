import { GEMINI_TASK_PREFIX } from "@/lib/gemini-constants";
import { MINIMAX_RECOVER_MAX_AGE_MS, MINIMAX_TASK_PREFIX } from "@/lib/minimax-constants";

function assetAgeMs(createdAt?: string | null): number {
  const createdMs = Date.parse(createdAt || "");
  return Number.isFinite(createdMs) && createdMs > 0 ? Date.now() - createdMs : 0;
}

function parseMiniMaxHistoryId(historyId: string | null | undefined): string | null {
  if (!historyId?.startsWith(MINIMAX_TASK_PREFIX)) return null;
  const id = historyId.slice(MINIMAX_TASK_PREFIX.length).trim();
  return id || null;
}

function parseGeminiHistoryId(historyId: string | null | undefined): string | null {
  if (!historyId?.startsWith(GEMINI_TASK_PREFIX)) return null;
  const id = historyId.slice(GEMINI_TASK_PREFIX.length).trim();
  return id || null;
}

/** Client-safe — mirrors server recover eligibility without Node-only imports. */
export function isRecoverableProviderAsset(a: {
  deletedAt?: string | null;
  historyId?: string | null;
  status?: string;
  url?: string;
  createdAt?: string;
  error?: string | null;
}): boolean {
  if (a.deletedAt || !a.historyId) return false;
  const mm = parseMiniMaxHistoryId(a.historyId);
  const gm = parseGeminiHistoryId(a.historyId);
  if (!mm && !gm) return false;
  if (a.status === "completed" && a.url) return false;

  const maxAge = mm ? MINIMAX_RECOVER_MAX_AGE_MS : 7 * 24 * 60 * 60 * 1000;
  if (assetAgeMs(a.createdAt) > maxAge) return false;

  if (a.status === "failed") return true;
  if (a.status === "running" && assetAgeMs(a.createdAt) > 2 * 60 * 1000) {
    return true;
  }
  if (
    a.status === "completed" &&
    !a.url &&
    assetAgeMs(a.createdAt) > 60 * 1000
  ) {
    return true;
  }
  if (
    a.error &&
    /مهلة|timeout|timed out/i.test(a.error) &&
    a.status !== "completed"
  ) {
    return true;
  }
  return false;
}
