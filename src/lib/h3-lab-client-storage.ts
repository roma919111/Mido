/**
 * Browser-side persistence for the H3 / AI Rental Studio generate panel:
 * active job id (survives refresh / tab switches) and the last UI snapshot.
 */

import { readEditDraft, resolveEditBoot, type CreateEditDraft } from "@/lib/edit-draft";

const H3_JOB_ID_KEY = "vyronix-h3-job-id-v1";
const H3_UI_CACHE_KEY = "vyronix-h3-ui-v1";
const H3_ACTIVE_JOB_COOKIE = "vyronix_h3_job";

export type H3VideoVariantStatus = "pending" | "generating" | "complete" | "error";

export type H3VideoVariant = {
  index: number;
  seed: number;
  status: H3VideoVariantStatus;
  jobId?: string;
  videoUrl?: string;
  progress?: string;
  error?: string;
};

export type H3UiCache = {
  jobId?: string;
  videoUrl?: string;
  videoVariants?: H3VideoVariant[];
  selectedVariantIndex?: number;
  generating?: boolean;
  progress?: string;
  submittedPrompt?: string;
  originalPrompt?: string;
  info?: string;
  error?: string;
  /** Epoch ms when the current generate started (elapsed = now − anchor). */
  elapsedAnchorMs?: number;
  cachedAt?: number;
};

function readStore(key: string): string | null {
  try {
    const s = sessionStorage.getItem(key);
    if (s) return s;
  } catch {
    // ignore
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore quota
  }
}

function clearStore(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function storeH3JobId(jobId: string): void {
  if (typeof window === "undefined" || !jobId.trim()) return;
  writeStore(H3_JOB_ID_KEY, jobId.trim());
}

export function readStoredH3JobId(): string | null {
  if (typeof window === "undefined") return null;
  return readStore(H3_JOB_ID_KEY)?.trim() || null;
}

export function clearStoredH3JobId(): void {
  if (typeof window === "undefined") return;
  clearStore(H3_JOB_ID_KEY);
}

/** Job id mirrored by the server in a readable cookie (fallback when storage was wiped). */
export function readH3ActiveJobIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${H3_ACTIVE_JOB_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (!item.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(item.slice(prefix.length)).trim() || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function readH3UiCache(): H3UiCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStore(H3_UI_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as H3UiCache;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Shallow-merge `patch` into the stored snapshot (keys set to `undefined` are dropped). */
export function writeH3UiCache(patch: H3UiCache): void {
  if (typeof window === "undefined") return;
  try {
    const next: H3UiCache = { ...(readH3UiCache() ?? {}), ...patch, cachedAt: Date.now() };
    writeStore(H3_UI_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
}

export function clearH3UiCache(): void {
  if (typeof window === "undefined") return;
  clearStore(H3_UI_CACHE_KEY);
}

export type RentalEngine = "ltx" | "vyronix";

export type RentalEditBoot = CreateEditDraft & {
  studioOrigin?: string;
  rentalEngine?: RentalEngine;
};

/** Assets → Edit hand-off, plus the rental studio origin / engine (`?studio=rental&engine=…`). */
export function resolveRentalEditBoot(): RentalEditBoot | null {
  if (typeof window === "undefined") return null;
  const boot = resolveEditBoot();
  if (!boot) return null;
  const draft = readEditDraft() as RentalEditBoot | null;
  const sp = new URLSearchParams(window.location.search);
  const engine = sp.get("engine")?.trim();
  const rentalEngine: RentalEngine | undefined =
    engine === "ltx" || engine === "vyronix" ? engine : draft?.rentalEngine;
  const studioOrigin =
    sp.get("studio") === "rental" || draft?.studioOrigin === "ai-rental"
      ? "ai-rental"
      : draft?.studioOrigin;
  return { ...boot, studioOrigin, rentalEngine };
}
