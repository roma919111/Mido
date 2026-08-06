import type { DialogueCue, TimelineClip } from "@/lib/edit-studio-timeline";

export function cueId(): string {
  return `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatCueTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Parse "90", "1:30", "0:05" → seconds. */
export function parseTimeInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  if (t.includes(":")) {
    const parts = t.split(":");
    if (parts.length !== 2) return null;
    const mm = Number(parts[0]);
    const ss = Number(parts[1]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0) return null;
    return mm * 60 + ss;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function sortDialogueCues(cues: DialogueCue[]): DialogueCue[] {
  return [...cues].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
}

/** Flat script view for legacy `dialogueText` storage. */
export function cuesToScript(cues: DialogueCue[]): string {
  return cues
    .map((c) => {
      const who = c.speaker?.trim();
      const range = `${formatCueTime(c.startSec)}–${formatCueTime(c.endSec)}`;
      const prefix = who ? `${who} (${range})` : range;
      return `${prefix}: ${c.text.trim()}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function normalizeDialogueCues(
  raw: Array<Partial<DialogueCue>>,
  maxDuration: number,
): DialogueCue[] {
  const safeMax = Math.max(0.5, maxDuration);
  const sorted = raw
    .map((c) => ({
      id: c.id || cueId(),
      speaker: (c.speaker ?? "").trim(),
      text: (c.text ?? "").trim(),
      startSec: Math.max(0, Number(c.startSec) || 0),
      endSec: Math.max(0, Number(c.endSec) || 0),
    }))
    .filter((c) => c.text)
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);

  return sorted.map((c, i) => {
    let start = Math.min(c.startSec, safeMax - 0.1);
    let end = Math.min(Math.max(c.endSec, start + 0.2), safeMax);
    if (end <= start) end = Math.min(start + 1.5, safeMax);
    const nextStart = sorted[i + 1]?.startSec;
    if (typeof nextStart === "number" && end > nextStart) {
      end = Math.max(start + 0.15, nextStart - 0.05);
    }
    return { ...c, startSec: start, endSec: end };
  });
}

export function resolveCueTimelineDuration(
  clip: TimelineClip,
  playDuration: number,
  cues?: DialogueCue[],
): number {
  const list = cues ?? clip.dialogueCues ?? [];
  const maxFromCues = list.reduce(
    (m, c) => Math.max(m, Number(c.endSec) || 0, Number(c.startSec) || 0),
    0,
  );
  const clipDur = Math.max(clip.durationSec ?? 0, playDuration);
  return Math.max(1, clipDur, maxFromCues + 0.5);
}

/** Preview/export cues with stable times (no overlap shrinking). */
export function getPreviewDialogueCues(clip: TimelineClip): DialogueCue[] {
  if (clip.dialogueCues?.length) {
    return sortDialogueCues(
      clip.dialogueCues
        .map((c) => ({
          ...c,
          speaker: (c.speaker ?? "").trim(),
          text: (c.text ?? "").trim(),
          startSec: Math.max(0, Number(c.startSec) || 0),
          endSec: Math.max(0, Number(c.endSec) || 0),
        }))
        .filter((c) => c.text && c.endSec > c.startSec),
    );
  }
  const text = clip.dialogueText?.trim();
  if (!text) return [];
  const end = Math.max(0.5, clip.durationSec ?? 30);
  return [{ id: "legacy", speaker: "", text, startSec: 0, endSec: end }];
}

export function getEffectiveDialogueCues(
  clip: TimelineClip,
  playDuration: number,
): DialogueCue[] {
  if (clip.dialogueCues?.length) {
    const maxDur = resolveCueTimelineDuration(clip, playDuration, clip.dialogueCues);
    return normalizeDialogueCues(clip.dialogueCues, maxDur);
  }
  const text = clip.dialogueText?.trim();
  if (!text) return [];
  return [
    {
      id: "legacy",
      speaker: "",
      text,
      startSec: 0,
      endSec: Math.max(0.5, playDuration),
    },
  ];
}

/** Match cue only while playhead is inside [startSec, endSec]. */
export function findActiveDialogueCue(
  cues: DialogueCue[],
  relativeSec: number,
): DialogueCue | null {
  if (!cues.length) return null;
  const t = Math.max(0, relativeSec);
  return cues.find((c) => t >= c.startSec && t <= c.endSec) ?? null;
}

export function characterId(): string {
  return `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function mergeCharacterCues(
  existing: DialogueCue[],
  incoming: DialogueCue[],
  characterName: string,
  maxDuration: number,
): DialogueCue[] {
  const name = characterName.trim();
  if (!name) return normalizeDialogueCues(existing, maxDuration);
  const kept = existing.filter((c) => c.speaker.trim() !== name);
  const tagged = incoming.map((c) => ({
    ...c,
    id: c.id || cueId(),
    speaker: name,
  }));
  return normalizeDialogueCues([...kept, ...tagged], maxDuration);
}

export function subtitleDisplayText(cue: DialogueCue): string {
  const who = cue.speaker?.trim();
  return who ? `${who}: ${cue.text}` : cue.text;
}

/** Resolve trim range for playback / audio extraction (handles unset trimEnd). */
export function resolveClipPlayRange(
  clip: TimelineClip,
  durationHint = 0,
): { start: number; end: number; playDuration: number; fullClip: boolean } {
  const start = Math.max(0, clip.trimStart);
  const knownDur = Math.max(0, durationHint || clip.durationSec || 0);

  if (clip.trimEnd > start) {
    return {
      start,
      end: clip.trimEnd,
      playDuration: Math.max(0.1, clip.trimEnd - start),
      fullClip: false,
    };
  }

  if (knownDur > start) {
    return {
      start,
      end: knownDur,
      playDuration: Math.max(0.1, knownDur - start),
      fullClip: false,
    };
  }

  return { start, end: 0, playDuration: Math.max(0.1, knownDur), fullClip: true };
}
