import {
  cuesToScript,
  mergeCharacterCues,
  normalizeDialogueCues,
  resolveClipPlayRange,
} from "@/lib/edit-studio-dialogue";
import type { DialogueCue, TimelineClip } from "@/lib/edit-studio-timeline";
import { fetchJson } from "@/lib/fetch-json";

export type TranscribeProgress =
  | { phase: "audio" }
  | { phase: "transcribe"; current: 1; total: 1 };

/** Server extracts audio (ffmpeg) + Gemini transcribe — one request. */
async function transcribeClip(
  clip: TimelineClip,
  playDuration: number,
  body: Record<string, unknown>,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<{
  cues: DialogueCue[];
  text: string;
  error?: string;
  usedFallback?: boolean;
}> {
  onProgress?.({ phase: "audio" });
  const { start } = resolveClipPlayRange(clip, playDuration);

  onProgress?.({ phase: "transcribe", current: 1, total: 1 });
  const { res, data } = await fetchJson<{
    cues?: DialogueCue[];
    text?: string;
    error?: string;
    usedFallback?: boolean;
  }>("/api/transcribe-subtitle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoUrl: clip.videoUrl,
      historyId: clip.historyId,
      trimStart: start,
      clipDurationSec: playDuration,
      ...body,
    }),
  });

  if (!res.ok) {
    return {
      cues: [],
      text: "",
      error: data.error || "transcribe_failed",
    };
  }

  const cues = normalizeDialogueCues(data.cues ?? [], playDuration);
  if (!cues.length) {
    return { cues: [], text: "", error: data.error || "no_dialogue" };
  }

  return {
    cues,
    text: data.text?.trim() || cuesToScript(cues),
    usedFallback: data.usedFallback,
  };
}

/** Extract ALL speech from clip (no character filter). */
export async function autoTranscribeAll(
  clip: TimelineClip,
  durationHint = 0,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<{
  cues: DialogueCue[];
  text: string;
  error?: string;
}> {
  const { playDuration } = resolveClipPlayRange(clip, durationHint);
  const result = await transcribeClip(clip, playDuration, { mode: "all" }, onProgress);
  if (result.error && !result.cues.length) {
    return { cues: [], text: "", error: result.error };
  }
  return { cues: result.cues, text: result.text || cuesToScript(result.cues) };
}

/** Pull one character's speech from clip audio → timed Arabic cues. */
export async function autoTranscribeCharacter(
  clip: TimelineClip,
  characterName: string,
  durationHint = 0,
  characterVoiceIndex?: number,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<{
  cues: DialogueCue[];
  text: string;
  error?: string;
  usedFallback?: boolean;
}> {
  const name = characterName.trim();
  if (!name) {
    return { cues: [], text: "", error: "character_required" };
  }

  const { playDuration } = resolveClipPlayRange(clip, durationHint);
  const result = await transcribeClip(
    clip,
    playDuration,
    {
      mode: "character",
      characterName: name,
      characterVoiceIndex,
    },
    onProgress,
  );

  if (result.error && !result.cues.length) {
    return { cues: [], text: "", error: result.error };
  }

  const merged = mergeCharacterCues(clip.dialogueCues ?? [], result.cues, name, playDuration);
  return {
    cues: merged,
    text: cuesToScript(merged),
    usedFallback: result.usedFallback,
  };
}
