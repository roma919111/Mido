/**
 * Multi-clip timeline state for Editing Studio (/edit).
 * Clips append on transfer — never overwrite existing timeline.
 */

import type {
  EditStudioAspect,
  EditStudioFilter,
} from "@/lib/edit-studio-draft";

export const EDIT_STUDIO_TIMELINE_KEY = "veronix.editStudio.timeline.v1";
/** Legacy single-video handoff (migrated into timeline on load). */
export const EDIT_STUDIO_DRAFT_KEY = "veronix.editStudio.draft.v1";

export type { EditStudioAspect, EditStudioFilter };

export type EditStudioTransition = "none" | "fade" | "dissolve" | "wipe";

export type SubtitlePosition = "bottom" | "top" | "center";
export type SubtitleSize = "small" | "medium" | "large";
export type SubtitleBackground = "transparent" | "box" | "shadow";

export type DialogueCue = {
  id: string;
  /** Character or speaker label (Arabic). */
  speaker: string;
  /** Arabic subtitle line. */
  text: string;
  /** Seconds from trimmed clip start. */
  startSec: number;
  endSec: number;
};

export type DialogueCharacter = {
  id: string;
  name: string;
};

export type TimelineClip = {
  id: string;
  videoUrl: string;
  posterUrl?: string;
  assetId?: string;
  historyId?: string;
  prompt?: string;
  durationSec?: number;
  sourceAspectRatio?: string;
  trimStart: number;
  trimEnd: number;
  /** When true, trim sliders are locked for this clip. */
  trimLocked?: boolean;
  filter: EditStudioFilter;
  exportAspect: EditStudioAspect;
  /** Transition into the next clip (ignored for last clip). */
  transitionAfter?: EditStudioTransition;
  /** On-screen dialogue / subtitle (typically Arabic). */
  dialogueText?: string;
  /** Timed dialogue lines per speaker (preferred over flat dialogueText). */
  dialogueCues?: DialogueCue[];
  /** Named characters for per-speaker extraction. */
  dialogueCharacters?: DialogueCharacter[];
  /** Selected character id for dialogue extraction UI. */
  activeDialogueCharacterId?: string | null;
  subtitlePosition?: SubtitlePosition;
  subtitleSize?: SubtitleSize;
  subtitleBackground?: SubtitleBackground;
};

export type EditStudioTimeline = {
  clips: TimelineClip[];
  activeClipId: string | null;
};

export type ClipInput = {
  videoUrl: string;
  posterUrl?: string;
  assetId?: string;
  historyId?: string;
  prompt?: string;
  durationSec?: number;
  aspectRatio?: string;
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

function clipIdFor(input: ClipInput): string {
  const base = input.assetId || input.historyId || input.videoUrl.slice(-48);
  return `clip-${base}-${Date.now().toString(36)}`;
}

export function defaultClip(input: ClipInput): TimelineClip {
  return {
    id: clipIdFor(input),
    videoUrl: input.videoUrl.trim(),
    posterUrl: input.posterUrl,
    assetId: input.assetId,
    historyId: input.historyId,
    prompt: input.prompt,
    durationSec: input.durationSec,
    sourceAspectRatio: input.aspectRatio,
    trimStart: 0,
    trimEnd: 0,
    trimLocked: false,
    filter: "none",
    exportAspect: "16:9",
    transitionAfter: "none",
    dialogueText: "",
    dialogueCues: [],
    dialogueCharacters: [],
    activeDialogueCharacterId: null,
    subtitlePosition: "bottom",
    subtitleSize: "medium",
    subtitleBackground: "box",
  };
}

export function readEditStudioTimeline(): EditStudioTimeline {
  if (typeof window === "undefined") {
    return { clips: [], activeClipId: null };
  }
  try {
    const raw = readStore(EDIT_STUDIO_TIMELINE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as EditStudioTimeline;
      if (parsed && Array.isArray(parsed.clips)) {
        return {
          clips: parsed.clips.filter((c) => c?.videoUrl?.trim()),
          activeClipId: parsed.activeClipId || parsed.clips[0]?.id || null,
        };
      }
    }
  } catch {
    // fall through to legacy migration
  }

  const legacy = readLegacyDraft();
  if (legacy) {
    const clip: TimelineClip = {
      id: clipIdFor(legacy),
      videoUrl: legacy.videoUrl,
      posterUrl: legacy.posterUrl,
      assetId: legacy.assetId,
      historyId: legacy.historyId,
      prompt: legacy.prompt,
      durationSec: legacy.durationSec,
      sourceAspectRatio: legacy.aspectRatio,
      trimStart: legacy.trimStart ?? 0,
      trimEnd: legacy.trimEnd ?? 0,
      filter: legacy.filter ?? "none",
      exportAspect: legacy.exportAspect ?? "16:9",
    };
    const timeline = { clips: [clip], activeClipId: clip.id };
    writeEditStudioTimeline(timeline);
    clearLegacyDraft();
    return timeline;
  }

  return { clips: [], activeClipId: null };
}

function readLegacyDraft(): {
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
} | null {
  try {
    const raw = readStore(EDIT_STUDIO_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { videoUrl?: string };
    if (!parsed?.videoUrl?.trim()) return null;
    return parsed as ReturnType<typeof readLegacyDraft> extends infer T ? NonNullable<T> : never;
  } catch {
    return null;
  }
}

function clearLegacyDraft() {
  try {
    sessionStorage.removeItem(EDIT_STUDIO_DRAFT_KEY);
    localStorage.removeItem(EDIT_STUDIO_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function writeEditStudioTimeline(timeline: EditStudioTimeline) {
  if (typeof window === "undefined") return;
  try {
    writeStore(EDIT_STUDIO_TIMELINE_KEY, JSON.stringify(timeline));
  } catch {
    // ignore quota
  }
}

/** Append new clips to the end — does not remove existing timeline entries. */
export function appendClipsToTimeline(inputs: ClipInput[]): EditStudioTimeline {
  const valid = inputs.filter((i) => i.videoUrl?.trim());
  const current = readEditStudioTimeline();
  if (!valid.length) return current;

  const newClips = valid.map(defaultClip);
  const clips = [...current.clips, ...newClips];
  const activeClipId = newClips[newClips.length - 1]?.id ?? current.activeClipId;
  const next = { clips, activeClipId };
  writeEditStudioTimeline(next);
  return next;
}

export function updateTimelineClip(
  clipId: string,
  patch: Partial<TimelineClip>,
): EditStudioTimeline {
  const current = readEditStudioTimeline();
  const clips = current.clips.map((c) =>
    c.id === clipId ? { ...c, ...patch } : c,
  );
  const next = { ...current, clips };
  writeEditStudioTimeline(next);
  return next;
}

export function removeTimelineClip(clipId: string): EditStudioTimeline {
  const current = readEditStudioTimeline();
  const clips = current.clips.filter((c) => c.id !== clipId);
  let activeClipId = current.activeClipId;
  if (activeClipId === clipId) {
    activeClipId = clips[clips.length - 1]?.id ?? null;
  }
  const next = { clips, activeClipId };
  writeEditStudioTimeline(next);
  return next;
}

export function moveTimelineClip(clipId: string, direction: -1 | 1): EditStudioTimeline {
  const current = readEditStudioTimeline();
  const idx = current.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return current;
  const target = idx + direction;
  if (target < 0 || target >= current.clips.length) return current;
  const clips = [...current.clips];
  const [item] = clips.splice(idx, 1);
  clips.splice(target, 0, item!);
  const next = { ...current, clips };
  writeEditStudioTimeline(next);
  return next;
}

export function setActiveTimelineClip(clipId: string | null): EditStudioTimeline {
  const current = readEditStudioTimeline();
  const next = { ...current, activeClipId: clipId };
  writeEditStudioTimeline(next);
  return next;
}

export function clearEditStudioTimeline() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(EDIT_STUDIO_TIMELINE_KEY);
    localStorage.removeItem(EDIT_STUDIO_TIMELINE_KEY);
  } catch {
    // ignore
  }
  clearLegacyDraft();
}

export function assetToClipInput(item: {
  id: string;
  url?: string;
  historyId?: string;
  prompt?: string;
  targetSeconds?: number;
  aspectRatio?: string;
}, mediaUrl: string | null, posterUrl?: string | null): ClipInput | null {
  if (!mediaUrl?.trim()) return null;
  return {
    videoUrl: mediaUrl,
    posterUrl: posterUrl || undefined,
    assetId: item.id,
    historyId: item.historyId,
    prompt: item.prompt,
    durationSec: item.targetSeconds,
    aspectRatio: item.aspectRatio,
  };
}
