/**
 * Hand-off from Assets Edit → CreateStudio
 * (prompt + character refs + optional start frame).
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
};

export function writeEditDraft(draft: CreateEditDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(EDIT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota
  }
}

export function readEditDraft(): CreateEditDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EDIT_DRAFT_KEY);
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
  try {
    sessionStorage.removeItem(EDIT_DRAFT_KEY);
  } catch {
    // ignore
  }
}
