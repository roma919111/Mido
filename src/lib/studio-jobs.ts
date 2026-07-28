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
