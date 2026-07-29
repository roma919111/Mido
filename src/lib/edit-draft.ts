/**
 * Hand-off from Assets Edit → CreateStudio
 * Restores prompt, characters, duration, resolution, aspect, clarity.
 *
 * Uses sessionStorage + localStorage so the draft survives soft navigations
 * and brief storage quirks on mobile.
 */

import type { VisualReference } from "@/lib/types";

export const EDIT_DRAFT_KEY = "veronix.create.editDraft.v1";

export type CreateEditDraft = {
  prompt: string;
  media: "video" | "image";
  startFrame?: VisualReference | null;
  /** Character stills (+ names in `label`) restored into Create */
  referenceImages?: VisualReference[];
  sourceAssetId?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  preferClarity?: boolean;
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

function clearStore(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function writeEditDraft(draft: CreateEditDraft) {
  if (typeof window === "undefined") return;
  try {
    writeStore(EDIT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota
  }
}

export function readEditDraft(): CreateEditDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStore(EDIT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateEditDraft;
    if (!parsed || typeof parsed.prompt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearEditDraft() {
  if (typeof window === "undefined") return;
  clearStore(EDIT_DRAFT_KEY);
}

/** Clamp a restored video duration into the paid Seedance window. */
export function clampEditDuration(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 4) return null;
  return Math.min(15, Math.max(4, Math.round(n)));
}

/**
 * Merge session draft + URL query (`?edit=1&duration=12…`) for a reliable boot.
 * URL wins for scalar settings when present (survives storage races).
 */
export function resolveEditBoot(): CreateEditDraft | null {
  if (typeof window === "undefined") return null;
  const draft = readEditDraft();
  const sp = new URLSearchParams(window.location.search);
  const isEdit = sp.get("edit") === "1" || Boolean(draft);
  if (!isEdit) return null;

  const duration =
    clampEditDuration(sp.get("duration") || sp.get("d")) ??
    clampEditDuration(draft?.duration) ??
    undefined;
  const resolution = (sp.get("resolution") || sp.get("r") || draft?.resolution || "")
    .trim() || undefined;
  const aspectRatio = (sp.get("aspect") || sp.get("ar") || draft?.aspectRatio || "")
    .trim() || undefined;
  const clarityRaw = sp.get("clarity") || sp.get("c");
  const preferClarity =
    clarityRaw === "1" || clarityRaw === "true"
      ? true
      : clarityRaw === "0" || clarityRaw === "false"
        ? false
        : draft?.preferClarity;

  if (!draft && duration == null && !resolution && !aspectRatio) {
    // edit=1 with nothing to restore
    if (!sp.get("edit")) return null;
  }

  return {
    prompt: draft?.prompt || "",
    media: draft?.media || "video",
    startFrame: draft?.startFrame ?? null,
    referenceImages: draft?.referenceImages,
    sourceAssetId: draft?.sourceAssetId,
    duration: duration ?? undefined,
    resolution,
    aspectRatio,
    preferClarity,
  };
}
