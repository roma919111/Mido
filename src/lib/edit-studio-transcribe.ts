import {
  cuesToScript,
  mergeCharacterCues,
  normalizeDialogueCues,
  resolveClipPlayRange,
} from "@/lib/edit-studio-dialogue";
import {
  extractClipAudio,
  uint8ToBase64,
} from "@/lib/edit-studio-ffmpeg";
import type { DialogueCue, TimelineClip } from "@/lib/edit-studio-timeline";
import { fetchJson } from "@/lib/fetch-json";

export type TranscribeProgress =
  | { phase: "audio" }
  | { phase: "transcribe"; current: 1; total: 1 };

/** Prefer client FFmpeg.wasm audio — server only transcribes (Gemini). */
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

  const payload: Record<string, unknown> = {
    trimStart: start,
    clipDurationSec: playDuration,
    ...body,
  };

  try {
    const audio = await extractClipAudio(clip, playDuration);
    if (audio?.data?.length) {
      payload.audioBase64 = uint8ToBase64(audio.data);
      payload.mimeType = audio.mimeType;
    }
  } catch {
    // fall through — server may extract if SERVER_FFMPEG enabled
  }

  if (!payload.audioBase64) {
    payload.videoUrl = clip.videoUrl;
    payload.historyId = clip.historyId;
  }

  onProgress?.({ phase: "transcribe", current: 1, total: 1 });
  const { res, data } = await fetchJson<{
    cues?: DialogueCue[];
    text?: string;
    error?: string;
    usedFallback?: boolean;
  }>("/api/transcribe-subtitle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  usedFallback?: boolean;
}> {
  const { playDuration } = resolveClipPlayRange(clip, durationHint);
  const result = await transcribeClip(clip, playDuration, { mode: "all" }, onProgress);
  if (result.error && !result.cues.length) {
    return { cues: [], text: "", error: result.error };
  }
  return {
    cues: result.cues,
    text: result.text,
    error: result.error,
    usedFallback: result.usedFallback,
  };
}

/** Extract dialogue for one named character. */
export async function autoTranscribeCharacter(
  clip: TimelineClip,
  characterName: string,
  durationHint = 0,
  voiceIndex = 0,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<{
  cues: DialogueCue[];
  text: string;
  error?: string;
  usedFallback?: boolean;
}> {
  const { playDuration } = resolveClipPlayRange(clip, durationHint);
  const result = await transcribeClip(
    clip,
    playDuration,
    {
      mode: "character",
      characterName,
      characterVoiceIndex: voiceIndex,
    },
    onProgress,
  );
  if (result.error && !result.cues.length) {
    return { cues: [], text: "", error: result.error };
  }
  const merged = mergeCharacterCues(
    clip.dialogueCues ?? [],
    result.cues,
    characterName,
    playDuration,
  );
  return {
    cues: merged,
    text: result.text || cuesToScript(result.cues),
    error: result.error,
    usedFallback: result.usedFallback,
  };
}
