import { TRANSITION_SEC } from "@/lib/edit-studio-ffmpeg";
import type { EditStudioTransition, TimelineClip } from "@/lib/edit-studio-timeline";

export { TRANSITION_SEC };

export function clipTrimEnd(clip: TimelineClip, dur: number) {
  return clip.trimEnd > 0 ? clip.trimEnd : dur;
}

export function clipPlayDuration(clip: TimelineClip, dur: number) {
  const end = clipTrimEnd(clip, dur);
  return Math.max(0.1, end - Math.max(0, clip.trimStart));
}

export function clipTransitionOverlap(clip: TimelineClip): number {
  const tr = clip.transitionAfter ?? "none";
  return tr !== "none" ? TRANSITION_SEC : 0;
}

/** Per-clip timeline length — matches export xfade overlap. */
export function clipSequenceDuration(clip: TimelineClip, fullDuration: number): number {
  return Math.max(0.05, clipPlayDuration(clip, fullDuration) - clipTransitionOverlap(clip));
}

export function totalTimelineDuration(
  clips: TimelineClip[],
  durationOf: (clip: TimelineClip) => number,
): number {
  return clips.reduce((sum, c) => sum + clipSequenceDuration(c, durationOf(c)), 0);
}

export type ClipAtGlobalTime = {
  clipIndex: number;
  localTime: number;
  inTransition: boolean;
  transitionProgress: number;
  transitionType: EditStudioTransition;
  nextClipIndex: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function locateClipAtGlobalTime(
  clips: TimelineClip[],
  durationOf: (clip: TimelineClip) => number,
  globalTime: number,
): ClipAtGlobalTime {
  let remaining = Math.max(0, globalTime);

  for (let i = 0; i < clips.length; i += 1) {
    const clip = clips[i]!;
    const full = durationOf(clip);
    const seq = clipSequenceDuration(clip, full);
    const trimStart = clip.trimStart;
    const trimEnd = clipTrimEnd(clip, full);
    const overlap = clipTransitionOverlap(clip);

    if (remaining <= seq + 0.001 || i === clips.length - 1) {
      const local = trimStart + remaining;
      const transitionStart = trimEnd - overlap;
      const inTransition =
        overlap > 0 && local >= transitionStart - 0.001 && i < clips.length - 1;
      const transitionProgress = inTransition
        ? clamp((local - transitionStart) / overlap, 0, 1)
        : 0;

      return {
        clipIndex: i,
        localTime: clamp(local, trimStart, trimEnd),
        inTransition,
        transitionProgress,
        transitionType: clip.transitionAfter ?? "none",
        nextClipIndex: inTransition ? i + 1 : null,
      };
    }
    remaining -= seq;
  }

  const lastIdx = clips.length - 1;
  const last = clips[lastIdx]!;
  const full = durationOf(last);
  return {
    clipIndex: lastIdx,
    localTime: clipTrimEnd(last, full),
    inTransition: false,
    transitionProgress: 0,
    transitionType: "none",
    nextClipIndex: null,
  };
}

export function globalTimeForClipPosition(
  clips: TimelineClip[],
  durationOf: (clip: TimelineClip) => number,
  clipIndex: number,
  localTime: number,
): number {
  let elapsed = 0;
  for (let i = 0; i < clipIndex; i += 1) {
    elapsed += clipSequenceDuration(clips[i]!, durationOf(clips[i]!));
  }
  const clip = clips[clipIndex]!;
  elapsed += Math.max(0, localTime - clip.trimStart);
  return elapsed;
}
