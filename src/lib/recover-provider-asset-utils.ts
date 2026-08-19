import { GEMINI_TASK_PREFIX } from "@/lib/gemini-constants";
import { KLING_TASK_PREFIX } from "@/lib/kling-constants";
import { FLUX_TASK_PREFIX } from "@/lib/flux-constants";
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

function parseKlingHistoryId(historyId: string | null | undefined): string | null {
  if (!historyId?.startsWith(KLING_TASK_PREFIX)) return null;
  const id = historyId.slice(KLING_TASK_PREFIX.length).trim();
  return id || null;
}

function parseFluxHistoryId(historyId: string | null | undefined): string | null {
  if (!historyId?.startsWith(FLUX_TASK_PREFIX)) return null;
  const id = historyId.slice(FLUX_TASK_PREFIX.length).trim();
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
  const kl = parseKlingHistoryId(a.historyId);
  const fl = parseFluxHistoryId(a.historyId);
  if (!mm && !gm && !kl && !fl) return false;
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
