/**
 * Hand-off from Assets / Create results → Editing Studio (/edit).
 * Separate from edit-draft.ts (re-generation in CreateStudio).
 */

export const EDIT_STUDIO_DRAFT_KEY = "veronix.editStudio.draft.v1";

export type EditStudioFilter = "none" | "cinematic" | "vintage" | "contrast" | "bw";

export type EditStudioAspect = "16:9" | "9:16" | "1:1";

export type EditStudioDraft = {
  videoUrl: string;
  posterUrl?: string;
  assetId?: string;
  historyId?: string;
  prompt?: string;
  durationSec?: number;
  aspectRatio?: string;
  trimStart?: number;
  trimEnd?: number;
  filter?: EditStudioFilter;
  exportAspect?: EditStudioAspect;
};

function writeStore(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

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

export function writeEditStudioDraft(draft: EditStudioDraft) {
  if (typeof window === "undefined") return;
  try {
    writeStore(EDIT_STUDIO_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota
  }
}

export function readEditStudioDraft(): EditStudioDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStore(EDIT_STUDIO_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditStudioDraft;
    if (!parsed?.videoUrl?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearEditStudioDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(EDIT_STUDIO_DRAFT_KEY);
    localStorage.removeItem(EDIT_STUDIO_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Boot editor from stored draft (survives navigation). */
export function resolveEditStudioBoot(): EditStudioDraft | null {
  return readEditStudioDraft();
}
