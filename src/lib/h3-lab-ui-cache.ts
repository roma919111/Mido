/** H3 lab UI + job id persistence (production vyronix-h3-lab-* keys). */

import { fetchJson } from "@/lib/fetch-json";
import { veronixPosterSrc } from "@/lib/media-proxy";
import { readAssetsCache, warmAssetPosters, writeAssetsCache } from "@/lib/assets-cache";

const JOB_ID_KEY = "vyronix-h3-lab-job-id";
const UI_CACHE_KEY = "vyronix-h3-lab-ui";

export type H3UiCache = {
  generating?: boolean;
  jobId?: string;
  prompt?: string;
  [key: string]: unknown;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readH3UiCache(): H3UiCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(UI_CACHE_KEY) ?? sessionStorage.getItem(UI_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as H3UiCache;
  } catch {
    return null;
  }
}

export function writeH3UiCache(patch: H3UiCache): void {
  const store = storage();
  if (!store) return;
  try {
    const merged = { ...readH3UiCache(), ...patch };
    const json = JSON.stringify(merged);
    store.setItem(UI_CACHE_KEY, json);
    try {
      sessionStorage.setItem(UI_CACHE_KEY, json);
    } catch {
      /* quota */
    }
  } catch {
    /* private mode */
  }
}

export function clearH3UiCache(): void {
  try {
    localStorage.removeItem(UI_CACHE_KEY);
    sessionStorage.removeItem(UI_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function readH3ActiveJobIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)h3_active_job=([^;]+)/);
  return m?.[1]?.trim() || null;
}

export function readStoredH3JobId(): string | null {
  try {
    return (
      localStorage.getItem(JOB_ID_KEY)?.trim() ||
      sessionStorage.getItem(JOB_ID_KEY)?.trim() ||
      readH3ActiveJobIdFromCookie() ||
      null
    );
  } catch {
    return null;
  }
}

export function storeH3JobId(jobId: string): void {
  try {
    localStorage.setItem(JOB_ID_KEY, jobId);
    sessionStorage.setItem(JOB_ID_KEY, jobId);
  } catch {
    /* ignore */
  }
}

export function clearStoredH3JobId(): void {
  try {
    localStorage.removeItem(JOB_ID_KEY);
    sessionStorage.removeItem(JOB_ID_KEY);
    document.cookie = "h3_active_job=; Path=/; Max-Age=0; SameSite=Lax";
    clearH3UiCache();
  } catch {
    /* ignore */
  }
}

export function hasH3GenerationInFlight(): boolean {
  const ui = readH3UiCache();
  if (ui?.generating && (ui.jobId || readStoredH3JobId())) return true;
  return !!(readStoredH3JobId() || readH3ActiveJobIdFromCookie());
}

/** Warm assets list when user hovers BottomNav (same as production). */
export function prefetchAssetsForBottomNav(): void {
  void (async () => {
    try {
      const { res, data } = await fetchJson<{ assets?: import("@/lib/assets-cache").CachedAssetItem[] }>(
        "/api/assets",
        { credentials: "include" },
      );
      if (!res.ok || !data.assets) return;
      const assets = data.assets.filter((a) => a.mode !== "sequence-part");
      writeAssetsCache(assets);
      warmAssetPosters(assets, (item) =>
        veronixPosterSrc({ historyId: item.historyId, url: item.url }),
      );
    } catch {
      /* ignore */
    }
  })();
}

/** @deprecated use readAssetsCache from assets-cache */
export { readAssetsCache };
