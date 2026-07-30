/**
 * Hand-off from Assets Edit → CreateStudio
 * Restores prompt, characters, duration, resolution, aspect, clarity.
 *
 * Uses sessionStorage + localStorage so the draft survives soft navigations
 * and brief storage quirks on mobile. An in-memory sticky copy keeps character
 * stills even when storage quota rejects large payloads, and survives React
 * Strict Mode remounts on the Create page.
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
  /**
   * When true with startFrame, Create loads the still as video Start Frame
   * (image → video) instead of a character slot.
   */
  useAsStartFrame?: boolean;
  /** Unique per Edit tap so Create re-applies even for the same asset. */
  handoffAt?: number;
};

/** Same-tab memory — survives storage quota failures + Strict Mode remount. */
let stickyDraft: CreateEditDraft | null = null;
/** True after writeEditDraft until dismissEditDraft (not cleared by clearEditDraft). */
let editBootLive = false;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

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

function parseDraft(raw: string | null): CreateEditDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CreateEditDraft;
    if (!parsed || typeof parsed.prompt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Compact refs so sessionStorage can hold the draft (prefer paths over data URLs). */
function compactDraftForStorage(draft: CreateEditDraft): CreateEditDraft {
  const compactUrl = (url: string | undefined | null): string | null => {
    const u = (url || "").trim();
    if (!u) return null;
    if (u.startsWith("data:image/") && u.length > 180_000) return null;
    return u;
  };
  const referenceImages = (draft.referenceImages || [])
    .map((r, i) => {
      const url = compactUrl(r?.url);
      if (!url) return null;
      return {
        type: "image" as const,
        id: r.id || `edit-ref-${i}`,
        url,
        label: r.label || "",
      };
    })
    .filter((r): r is VisualReference => Boolean(r));

  const startUrl = compactUrl(draft.startFrame?.url);
  return {
    ...draft,
    referenceImages,
    startFrame:
      draft.startFrame && startUrl
        ? { ...draft.startFrame, url: startUrl }
        : draft.startFrame?.url && !startUrl
          ? null
          : draft.startFrame ?? null,
  };
}

export function writeEditDraft(draft: CreateEditDraft) {
  if (typeof window === "undefined") return;
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  const next: CreateEditDraft = {
    ...draft,
    handoffAt: draft.handoffAt ?? Date.now(),
  };
  stickyDraft = next;
  editBootLive = true;
  try {
    writeStore(EDIT_DRAFT_KEY, JSON.stringify(compactDraftForStorage(next)));
  } catch {
    // Sticky memory still holds the full draft for this tab.
  }
  try {
    window.dispatchEvent(
      new CustomEvent("veronix:edit-draft", { detail: { handoffAt: next.handoffAt } }),
    );
  } catch {
    // ignore
  }
}

function readStoredEditDraft(): CreateEditDraft | null {
  if (typeof window === "undefined") return null;
  return parseDraft(readStore(EDIT_DRAFT_KEY));
}

export function readEditDraft(): CreateEditDraft | null {
  if (typeof window === "undefined") return null;
  const stored = readStoredEditDraft();
  if (stored) {
    // Prefer sticky stills when storage was compacted/truncated.
    const stickyRefs = stickyDraft?.referenceImages?.length || 0;
    const storedRefs = stored.referenceImages?.length || 0;
    const stickyHasStart = Boolean(stickyDraft?.startFrame?.url);
    const storedHasStart = Boolean(stored.startFrame?.url);
    if (
      stickyDraft &&
      (stickyRefs > storedRefs || (stickyHasStart && !storedHasStart))
    ) {
      return {
        ...stored,
        referenceImages:
          stickyRefs > storedRefs
            ? stickyDraft.referenceImages
            : stored.referenceImages,
        startFrame:
          stickyHasStart && !storedHasStart
            ? stickyDraft.startFrame
            : stickyDraft.startFrame ?? stored.startFrame,
        useAsStartFrame:
          stickyDraft.useAsStartFrame ?? stored.useAsStartFrame,
      };
    }
    stickyDraft = stored;
    return stored;
  }
  return editBootLive ? stickyDraft : null;
}

/** Clear durable storage only — keep sticky boot for Create remounts. */
export function clearEditDraft() {
  if (typeof window === "undefined") return;
  clearStore(EDIT_DRAFT_KEY);
}

/** Fully drop Edit hand-off (fresh Create / leave Create). */
export function dismissEditDraft() {
  if (typeof window === "undefined") return;
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  stickyDraft = null;
  editBootLive = false;
  clearStore(EDIT_DRAFT_KEY);
}

/**
 * After Create unmounts, drop sticky boot unless we are still on /create
 * (Strict Mode remount) or Edit just wrote a new draft.
 */
export function armEditDraftDismiss(ms = 900) {
  if (typeof window === "undefined") return;
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    dismissTimer = null;
    try {
      if (window.location.pathname.startsWith("/create") && editBootLive) {
        return;
      }
    } catch {
      // ignore
    }
    dismissEditDraft();
  }, ms);
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
    useAsStartFrame: Boolean(draft?.useAsStartFrame),
    handoffAt: draft?.handoffAt,
  };
}
