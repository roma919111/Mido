/**
 * Persist Create Studio result cards across Assets / Home navigation.
 * Prefer localStorage so jobs survive remounts; migrate old session preview.
 */

import { estimateGenerateSeconds } from "@/lib/generate-eta";

export type StudioJob = {
  clientId: string;
  url: string;
  mediaType: "image" | "video";
  historyId?: string;
  status: "running" | "completed" | "failed";
  freeTrial?: boolean;
  assetId?: string;
  /** Output length — ETA context only */
  targetSeconds?: number;
  startedAt?: number | null;
  error?: string;
  /** Prompt used for this job — restored on Edit */
  prompt?: string;
  /** When the clip URL first landed (prep timer anchor). */
  completedAt?: number;
  /** Output resolution label — clarity ETA only. */
  resolution?: string;
  /** Clarity grade still running server-side. */
  clarityPending?: boolean;
};

const JOBS_KEY = "veronix.create.jobs.v2";
const LEGACY_PREVIEW_KEY = "veronix.create.preview.v1";
const MAX_JOBS = 12;

export function newStudioClientId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readStoredJobs(): StudioJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(JOBS_KEY) || sessionStorage.getItem(JOBS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { jobs?: StudioJob[] } | StudioJob[];
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.jobs)
          ? parsed.jobs
          : [];
      return list
        .filter((j) => j && typeof j.clientId === "string")
        .slice(0, MAX_JOBS);
    }

    // Migrate singular preview from older builds.
    const legacy = sessionStorage.getItem(LEGACY_PREVIEW_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy) as {
      preview?: Omit<StudioJob, "clientId">;
      genStartedAt?: number | null;
    };
    if (!parsed.preview) return [];
    const job: StudioJob = {
      ...parsed.preview,
      clientId: newStudioClientId(),
      startedAt:
        typeof parsed.genStartedAt === "number" ? parsed.genStartedAt : null,
    };
    writeStoredJobs([job]);
    return [job];
  } catch {
    return [];
  }
}

export function writeStoredJobs(jobs: StudioJob[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = jobs.slice(0, MAX_JOBS);
    const payload = JSON.stringify({ jobs: trimmed });
    localStorage.setItem(JOBS_KEY, payload);
    sessionStorage.setItem(JOBS_KEY, payload);
    // Clear legacy singular key so hydrate doesn't fight the list.
    sessionStorage.removeItem(LEGACY_PREVIEW_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export function upsertJob(jobs: StudioJob[], next: StudioJob): StudioJob[] {
  const idx = jobs.findIndex(
    (j) =>
      j.clientId === next.clientId ||
      (next.assetId && j.assetId === next.assetId) ||
      (next.historyId && j.historyId && j.historyId === next.historyId),
  );
  if (idx < 0) return [next, ...jobs].slice(0, MAX_JOBS);
  const copy = jobs.slice();
  copy[idx] = { ...copy[idx], ...next, clientId: copy[idx]!.clientId };
  return copy;
}

export function jobMatches(
  j: StudioJob,
  match: { clientId?: string; assetId?: string; historyId?: string },
): boolean {
  return Boolean(
    (match.clientId && j.clientId === match.clientId) ||
      (match.assetId && j.assetId === match.assetId) ||
      (match.historyId && j.historyId && j.historyId === match.historyId),
  );
}

export function patchJob(
  jobs: StudioJob[],
  match: { clientId?: string; assetId?: string; historyId?: string },
  patch: Partial<StudioJob>,
): StudioJob[] {
  return jobs.map((j) => (jobMatches(j, match) ? { ...j, ...patch } : j));
}

/** Patch an existing card, or insert when hydrate/prune dropped the placeholder. */
export function patchOrUpsertJob(
  jobs: StudioJob[],
  match: { clientId?: string; assetId?: string; historyId?: string },
  patch: Partial<StudioJob>,
  fallback: StudioJob,
): StudioJob[] {
  if (jobs.some((j) => jobMatches(j, match))) {
    return patchJob(jobs, match, patch);
  }
  return upsertJob(jobs, { ...fallback, ...patch, clientId: fallback.clientId });
}

export type AssetSyncRow = {
  id: string;
  url?: string;
  mediaType?: "image" | "video" | string;
  historyId?: string;
  status?: string;
  mode?: string;
  error?: string;
  prompt?: string;
  createdAt?: string;
  targetSeconds?: number;
};

/**
 * Mark Create "running" cards done when Assets already has the finished clip.
 * Matches by assetId / historyId, then by prompt + time window, then FIFO
 * among unmatched completed assets of the same media type.
 */
export function syncRunningJobsFromAssets(
  jobs: StudioJob[],
  assets: AssetSyncRow[],
  opts?: { mediaType?: "image" | "video" },
): { jobs: StudioJob[]; changed: boolean; clearedKeys: string[] } {
  const rows = assets.filter(
    (a) =>
      a &&
      a.mode !== "sequence-part" &&
      (!opts?.mediaType || a.mediaType === opts.mediaType),
  );
  const byId = new Map(rows.map((a) => [a.id, a]));
  const usedAssetIds = new Set(
    jobs
      .filter((j) => j.status === "completed" && j.assetId)
      .map((j) => j.assetId!),
  );
  const clearedKeys: string[] = [];
  let changed = false;

  const normPrompt = (p?: string) =>
    String(p || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120)
      .toLowerCase();

  const takeCompleted = (a: AssetSyncRow | undefined, j: StudioJob): StudioJob | null => {
    if (!a || a.status !== "completed" || !a.url) return null;
    if (usedAssetIds.has(a.id)) return null;
    usedAssetIds.add(a.id);
    changed = true;
    if (j.assetId) clearedKeys.push(j.assetId);
    if (j.historyId) clearedKeys.push(j.historyId);
    if (a.historyId) clearedKeys.push(a.historyId);
    if (j.clientId) clearedKeys.push(j.clientId);
    return {
      ...j,
      url: a.url,
      historyId: a.historyId || j.historyId,
      assetId: a.id || j.assetId,
      status: "completed",
      error: undefined,
      targetSeconds: j.targetSeconds || a.targetSeconds || j.targetSeconds,
      prompt: j.prompt || a.prompt || j.prompt,
      completedAt: j.completedAt || Date.now(),
    };
  };

  const takeFailed = (a: AssetSyncRow | undefined, j: StudioJob): StudioJob | null => {
    if (!a || a.status !== "failed") return null;
    changed = true;
    if (j.assetId) clearedKeys.push(j.assetId);
    if (j.historyId) clearedKeys.push(j.historyId);
    if (j.clientId) clearedKeys.push(j.clientId);
    return {
      ...j,
      status: "failed",
      error: a.error || "فشل التوليد",
      historyId: a.historyId || j.historyId,
      assetId: a.id || j.assetId,
    };
  };

  let next = jobs.map((j) => {
    if (j.status !== "running") return j;
    const direct =
      (j.assetId && byId.get(j.assetId)) ||
      (j.historyId
        ? rows.find((x) => x.historyId && x.historyId === j.historyId)
        : undefined);

    const done = takeCompleted(direct, j);
    if (done) return done;
    const fail = takeFailed(direct, j);
    if (fail) return fail;

    // Same asset still running but privacy-retry replaced historyId.
    if (direct?.status === "running" && direct.historyId && direct.historyId !== j.historyId) {
      changed = true;
      return {
        ...j,
        historyId: direct.historyId,
        assetId: direct.id || j.assetId,
      };
    }
    return j;
  });

  // Second pass: unmatched running ← unmatched completed (prompt then FIFO).
  const unmatchedCompleted = rows
    .filter(
      (a) =>
        a.status === "completed" &&
        a.url &&
        a.id &&
        !usedAssetIds.has(a.id),
    )
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

  next = next.map((j) => {
    if (j.status !== "running") return j;
    const jp = normPrompt(j.prompt);
    const started = j.startedAt || 0;
    let pick =
      jp &&
      unmatchedCompleted.find((a) => {
        if (usedAssetIds.has(a.id)) return false;
        if (opts?.mediaType && a.mediaType && a.mediaType !== j.mediaType) return false;
        if (a.mediaType && a.mediaType !== j.mediaType) return false;
        if (normPrompt(a.prompt) !== jp) return false;
        if (started > 0 && a.createdAt) {
          const t = Date.parse(a.createdAt);
          if (Number.isFinite(t) && t + 60_000 < started) return false;
        }
        return true;
      });

    if (!pick) {
      pick = unmatchedCompleted.find((a) => {
        if (usedAssetIds.has(a.id)) return false;
        if (a.mediaType && a.mediaType !== j.mediaType) return false;
        if (started > 0 && a.createdAt) {
          const t = Date.parse(a.createdAt);
          // Asset created within job window (or up to 25 min after start).
          if (Number.isFinite(t) && (t + 30_000 < started || t - started > 25 * 60_000)) {
            return false;
          }
        }
        return true;
      });
    }

    if (!pick) return j;
    const done = takeCompleted(pick, j);
    return done || j;
  });

  return { jobs: next, changed, clearedKeys };
}

const DEFAULT_MAX_WALL_MS = 10 * 60 * 1000;
const DEFAULT_STALE_GRACE_MS = 5 * 60 * 1000;

/** Drop or resolve stale "running" cards that freeze clocks in the UI. */
export function pruneGhostRunningJobs(
  jobs: StudioJob[],
  opts?: { maxWallMs?: number; staleGraceMs?: number },
): { jobs: StudioJob[]; changed: boolean } {
  const maxWallMs = opts?.maxWallMs ?? DEFAULT_MAX_WALL_MS;
  const staleGraceMs = opts?.staleGraceMs ?? DEFAULT_STALE_GRACE_MS;
  const now = Date.now();
  let changed = false;

  const next: StudioJob[] = [];
  for (const j of jobs) {
    if (j.status !== "running") {
      next.push(j);
      continue;
    }

    if (j.url) {
      changed = true;
      next.push({
        ...j,
        status: "completed",
        completedAt: j.completedAt || now,
        error: undefined,
      });
      continue;
    }

    const started = j.startedAt || 0;
    if (started <= 0) {
      changed = true;
      next.push({
        ...j,
        status: "failed",
        error: "توقف التوليد — أعد المحاولة",
      });
      continue;
    }

    const wallMs =
      j.historyId?.startsWith("gm:") || j.historyId?.startsWith("mm:")
        ? 45 * 60 * 1000
        : j.historyId?.startsWith("pv:") && (j.targetSeconds || 0) > 15
          ? 45 * 60 * 1000
          : maxWallMs;

    if (started > 0 && now - started >= wallMs) {
      changed = true;
      next.push({
        ...j,
        status: "failed",
        error:
          j.historyId?.startsWith("gm:") ||
          j.historyId?.startsWith("mm:") ||
          (j.historyId?.startsWith("pv:") && (j.targetSeconds || 0) > 15)
            ? "انتهت مهلة المتابعة في الإنشاء — افتح الأصول؛ التوليد قد يكون ما زال جاريًا"
            : "انتهت المهلة (10 دقائق) — أعد التوليد",
      });
      continue;
    }

    if (!j.assetId && !j.historyId) {
      // Generate API still in flight — placeholders have no ids yet.
      if (started > 0 && now - started < 5 * 60 * 1000) {
        next.push(j);
        continue;
      }
      changed = true;
      continue;
    }

    // Long PixVerse chains / Gemini / MiniMax outlive a single-clip ETA.
    if (
      !j.historyId?.startsWith("gm:") &&
      !j.historyId?.startsWith("mm:") &&
      !(j.historyId?.startsWith("pv:") && (j.targetSeconds || 0) > 15) &&
      started > 0
    ) {
      const target = j.targetSeconds || (j.mediaType === "image" ? 4 : 5);
      const etaMs = estimateGenerateSeconds(target, j.mediaType) * 1000;
      if (now - started > etaMs + staleGraceMs) {
        changed = true;
        next.push({
          ...j,
          status: "failed",
          error: "توقف التوليد — أعد المحاولة",
        });
        continue;
      }
    }

    next.push(j);
  }

  return { jobs: next.slice(0, MAX_JOBS), changed };
}

