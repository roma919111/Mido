/**
 * Persist Create Studio result cards across Assets / Home navigation.
 * Prefer localStorage so jobs survive remounts; migrate old session preview.
 */

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
  /**
   * Image→video Start Frame URL remembered on the card so Edit on failed
   * videos can restore the originally generated still without a DB hit.
   */
  startFrameUrl?: string;
  /** Character stills snapped at Generate — restored on failed Edit. */
  referenceImages?: import("@/lib/types").VisualReference[];
  aspectRatio?: string;
  resolution?: string;
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

export function patchJob(
  jobs: StudioJob[],
  match: { clientId?: string; assetId?: string; historyId?: string },
  patch: Partial<StudioJob>,
): StudioJob[] {
  return jobs.map((j) => {
    const hit =
      (match.clientId && j.clientId === match.clientId) ||
      (match.assetId && j.assetId === match.assetId) ||
      (match.historyId && j.historyId && j.historyId === match.historyId);
    return hit ? { ...j, ...patch } : j;
  });
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

  /** Strip AI framing so Create prompt still matches Assets prompt. */
  const normPrompt = (p?: string) =>
    String(p || "")
      .replace(/شخصية رقمية مولّدة بالذكاء الاصطناعي[^\n]*/giu, "")
      .replace(/AI-generated digital[^\n]*/gi, "")
      .replace(/Not a real-person[^\n]*/gi, "")
      .replace(/Digital cinematic[^\n]*/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160)
      .toLowerCase();

  const isReadyAsset = (a: AssetSyncRow | undefined) =>
    Boolean(
      a &&
        a.status === "completed" &&
        a.id &&
        (Boolean(a.url && String(a.url).trim()) || Boolean(a.historyId)),
    );

  const takeCompleted = (a: AssetSyncRow | undefined, j: StudioJob): StudioJob | null => {
    if (!isReadyAsset(a) || !a) return null;
    if (usedAssetIds.has(a.id)) return null;
    usedAssetIds.add(a.id);
    changed = true;
    if (j.assetId) clearedKeys.push(j.assetId);
    if (j.historyId) clearedKeys.push(j.historyId);
    if (a.historyId) clearedKeys.push(a.historyId);
    if (j.clientId) clearedKeys.push(j.clientId);
    return {
      ...j,
      url: a.url || j.url || "",
      historyId: a.historyId || j.historyId,
      assetId: a.id || j.assetId,
      status: "completed",
      error: undefined,
      targetSeconds: j.targetSeconds || a.targetSeconds || j.targetSeconds,
      prompt: j.prompt || a.prompt || j.prompt,
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

  const unmatchedCompleted = () =>
    rows
      .filter((a) => isReadyAsset(a) && a.id && !usedAssetIds.has(a.id))
      .sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
      );

  // Second pass: unmatched running ← unmatched completed (prompt then FIFO).
  next = next.map((j) => {
    if (j.status !== "running") return j;
    const pool = unmatchedCompleted();
    const jp = normPrompt(j.prompt);
    const started = j.startedAt || 0;
    let pick =
      jp &&
      pool.find((a) => {
        if (usedAssetIds.has(a.id)) return false;
        if (a.mediaType && a.mediaType !== j.mediaType) return false;
        const ap = normPrompt(a.prompt);
        if (!ap || ap !== jp) {
          // Allow substring match either direction (framing / truncation).
          if (!ap || !jp || (!ap.includes(jp) && !jp.includes(ap))) return false;
        }
        if (started > 0 && a.createdAt) {
          const t = Date.parse(a.createdAt);
          if (Number.isFinite(t) && t + 120_000 < started) return false;
        }
        return true;
      });

    if (!pick) {
      pick = pool.find((a) => {
        if (usedAssetIds.has(a.id)) return false;
        if (a.mediaType && a.mediaType !== j.mediaType) return false;
        if (started > 0 && a.createdAt) {
          const t = Date.parse(a.createdAt);
          // Wider window: asset up to 2 min before start, or 40 min after.
          if (
            Number.isFinite(t) &&
            (t + 120_000 < started || t - started > 40 * 60_000)
          ) {
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

  // Third pass: if Assets has no running rows left, force-pair remaining
  // Create "running" ghosts to newest unmatched completed clips.
  const serverStillRunning = rows.some((a) => a.status === "running");
  if (!serverStillRunning) {
    const leftover = next.filter((j) => j.status === "running");
    if (leftover.length) {
      const pool = unmatchedCompleted().reverse(); // newest first
      let pi = 0;
      next = next.map((j) => {
        if (j.status !== "running") return j;
        while (pi < pool.length && usedAssetIds.has(pool[pi]!.id)) pi += 1;
        const pick = pool[pi];
        if (!pick) return j;
        pi += 1;
        return takeCompleted(pick, j) || j;
      });
    }
  }

  return { jobs: next, changed, clearedKeys };
}

