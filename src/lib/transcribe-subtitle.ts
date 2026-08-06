/**
 * Transcribe clip audio → timed Arabic subtitle cues via Gemini (server-side).
 */

import {
  cueId,
  cuesToScript,
  normalizeDialogueCues,
} from "@/lib/edit-studio-dialogue";
import type { DialogueCue } from "@/lib/edit-studio-timeline";
import {
  GEMINI_AUDIO_MODEL_DEFAULT,
  GEMINI_AUDIO_MODEL_FALLBACKS,
} from "@/lib/gemini-constants";
import { getGeminiApiKey } from "@/lib/gemini-video";
import { hasArabic, isMostlyArabic, isMostlyEnglish } from "@/lib/prompt-translate";

function audioModels(): string[] {
  const fromEnv = process.env.GEMINI_AUDIO_MODEL?.trim();
  const defaults = [...GEMINI_AUDIO_MODEL_FALLBACKS];
  if (fromEnv) {
    return [fromEnv, ...defaults.filter((m) => m !== fromEnv)];
  }
  return defaults;
}

function parseGeminiApiError(errText: string): string {
  try {
    const parsed = JSON.parse(errText) as { error?: { message?: string; status?: string } };
    const msg = parsed.error?.message?.trim();
    if (msg) return msg;
  } catch {
    // plain text
  }
  return errText.slice(0, 200).trim() || "Gemini API error";
}

function isModelNotFoundError(errText: string): boolean {
  const t = errText.toLowerCase();
  return (
    t.includes("not found") ||
    t.includes("not_found") ||
    t.includes("does not exist") ||
    t.includes("is not supported")
  );
}

function friendlyTranscribeError(lastError: string, triedModels: string[]): string {
  const lower = lastError.toLowerCase();
  if (isModelNotFoundError(lower)) {
    return `نموذج Gemini للصوت غير متاح (جرّبنا: ${triedModels.slice(0, 3).join(", ")}). على Railway أضف GEMINI_AUDIO_MODEL=${GEMINI_AUDIO_MODEL_DEFAULT}`;
  }
  if (lower.includes("api key") || lower.includes("permission") || lower.includes("403")) {
    return "مفتاح GEMINI_API_KEY غير صالح أو بدون صلاحية — أنشئ مفتاحاً من Google AI Studio (AIzaSy… أو مفتاح AQ. الحالي).";
  }
  if (lower.includes("quota") || lower.includes("429")) {
    return "حصة Gemini مستنفدة — حاول بعد قليل.";
  }
  if (lower.includes("no speech detected")) {
    return "لم يُعثر على كلام في المقطع — تأكد أن الفيديو فيه صوت/حوار.";
  }
  return lastError.slice(0, 180) || "Transcription failed";
}

const MAX_AUDIO_B64_CHARS = 14 * 1024 * 1024;
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

export type TranscribeMode = "all" | "character";

export type TranscribeInput = {
  audioBase64: string;
  mimeType?: string;
  clipDurationSec?: number;
  mode?: TranscribeMode;
  characterName?: string;
  /** 0-based: first voice in clip = 0, second = 1, etc. */
  characterVoiceIndex?: number;
};

function parseGeminiJson(raw: string): { cues?: Array<Partial<DialogueCue>>; text?: string } {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as { cues?: Array<Partial<DialogueCue>>; text?: string };
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid JSON");
    return JSON.parse(match[0]) as { cues?: Array<Partial<DialogueCue>>; text?: string };
  }
}

function buildPrompt(input: TranscribeInput): string {
  const clipDurationSec = input.clipDurationSec ?? 0;
  const durationHint =
    clipDurationSec > 0
      ? `The clip is ${clipDurationSec.toFixed(1)} seconds long.`
      : "Estimate times from the audio length.";

  const timingRules = `
Timing rules (critical):
- startSec and endSec are seconds from the start of this clip (0 to clip end).
- Each cue must match when words are actually spoken.
- Order cues chronologically. Do not overlap cues for the same speaker.`;

  const arabicRules = `
Arabic output rules (mandatory — never skip):
- Every cue "text" field MUST be in Modern Standard Arabic (الفصحى) only.
- If speech is in English or any other language, TRANSLATE it to Arabic — do NOT leave English in "text".
- Never mix English and Arabic in the same "text" line.
- Keep person names and brands readable (Latin is OK only inside names like "PixVerse").`;

  if (input.mode === "character" && input.characterName?.trim()) {
    const speaker = input.characterName.trim();
    const voiceHint =
      typeof input.characterVoiceIndex === "number"
        ? `This character is human voice #${input.characterVoiceIndex + 1} in the clip.`
        : "Match the character to one distinct human voice.";

    return `Listen to this audio clip.
${durationHint}
${timingRules}
${arabicRules}
${voiceHint}

Extract ONLY lines spoken by "${speaker}".
One cue per spoken turn.
speaker must be exactly: "${speaker}"

Return JSON only:
{"cues":[{"speaker":"${speaker}","startSec":1.2,"endSec":4.0,"text":"..."}]}`;
  }

  return `Listen to this audio clip and transcribe ALL human speech.
${durationHint}
${timingRules}
${arabicRules}

One cue per spoken turn by each speaker.
First human voice = "Speaker 1", second = "Speaker 2", etc.

Return JSON only:
{"cues":[{"speaker":"Speaker 1","startSec":1.2,"endSec":4.0,"text":"..."}]}`;
}

async function callGemini(
  model: string,
  key: string,
  mimeType: string,
  audioBase64: string,
  prompt: string,
): Promise<{ raw: string; ok: boolean; errText?: string }> {
  const res = await fetch(
    `${GEMINI_API}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: audioBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { raw: "", ok: false, errText: parseGeminiApiError(errText) };
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return { raw, ok: Boolean(raw.trim()) };
}

function relabelCuesSpeaker(cues: DialogueCue[], speaker: string): DialogueCue[] {
  return cues.map((c) => ({ ...c, speaker }));
}

function filterCuesByVoiceIndex(cues: DialogueCue[], index: number): DialogueCue[] {
  const label = `Speaker ${index + 1}`;
  const matched = cues.filter(
    (c) =>
      c.speaker.trim() === label ||
      c.speaker.trim() === `Speaker${index + 1}` ||
      c.speaker.includes(String(index + 1)),
  );
  return matched.length ? matched : cues;
}

function parseCuesFromResponse(
  raw: string,
  maxDur: number,
  defaultSpeaker: string,
): DialogueCue[] {
  const parsed = parseGeminiJson(raw);
  let cues = normalizeDialogueCues(parsed.cues ?? [], maxDur);
  if (!cues.length && parsed.text?.trim()) {
    cues = normalizeDialogueCues(
      [
        {
          id: cueId(),
          speaker: defaultSpeaker,
          text: parsed.text.trim(),
          startSec: 0,
          endSec: maxDur,
        },
      ],
      maxDur,
    );
  }
  return cues;
}

/** True when cue text should be translated to Arabic (English or mixed). */
function cueNeedsArabic(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isMostlyArabic(t)) return false;
  if (isMostlyEnglish(t)) return true;
  // Mixed or Latin fragments without enough Arabic
  return /[A-Za-z]{3,}/.test(t) && !hasArabic(t);
}

async function translateCueLinesToArabic(lines: string[]): Promise<string[] | null> {
  if (!lines.length) return [];
  const key = getGeminiApiKey();
  if (!key) return null;

  const model =
    process.env.GEMINI_AUDIO_MODEL?.trim() ||
    process.env.GEMINI_TEXT_MODEL?.trim() ||
    GEMINI_AUDIO_MODEL_DEFAULT;

  const numbered = lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const prompt = `Translate each numbered subtitle line into natural Modern Standard Arabic for on-screen captions.
Rules:
- Output ONLY Arabic in each line (translate English/other languages fully).
- Keep the same count and order (${lines.length} lines).
- Keep person/brand names readable.
Return JSON only: {"lines":["arabic line 1","arabic line 2",...]}

Input:
${numbered}`;

  try {
    const res = await fetch(
      `${GEMINI_API}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = parseGeminiJson(raw) as { lines?: string[] };
    const out = parsed.lines?.map((s) => s.trim()).filter(Boolean);
    if (!out?.length || out.length !== lines.length) return null;
    return out;
  } catch {
    return null;
  }
}

async function ensureCuesArabic(cues: DialogueCue[]): Promise<DialogueCue[]> {
  const indices: number[] = [];
  const toTranslate: string[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    if (cueNeedsArabic(cues[i]!.text)) {
      indices.push(i);
      toTranslate.push(cues[i]!.text);
    }
  }
  if (!indices.length) return cues;

  const translated = await translateCueLinesToArabic(toTranslate);
  if (!translated) return cues;

  const next = cues.map((c) => ({ ...c }));
  for (let j = 0; j < indices.length; j += 1) {
    const idx = indices[j]!;
    const ar = translated[j]?.trim();
    if (ar) next[idx] = { ...next[idx]!, text: ar };
  }
  return next;
}

export async function transcribeClipDialogue(
  input: TranscribeInput,
): Promise<{ cues: DialogueCue[]; text: string; error?: string; usedFallback?: boolean }> {
  const audioBase64 = input.audioBase64.trim();
  const clipDurationSec = input.clipDurationSec ?? 0;
  const mode = input.mode ?? "all";
  const characterName = input.characterName?.trim() ?? "";
  const maxDur = clipDurationSec > 0 ? clipDurationSec : 120;

  if (!audioBase64) {
    return { cues: [], text: "", error: "Empty audio" };
  }
  if (audioBase64.length > MAX_AUDIO_B64_CHARS) {
    return { cues: [], text: "", error: "Audio too long — trim the clip shorter" };
  }

  const key = getGeminiApiKey();
  if (!key) {
    return { cues: [], text: "", error: "GEMINI_API_KEY غير مضاف على السيرفر" };
  }

  const prompt = buildPrompt({ ...input, mode, characterName });
  const models = audioModels();
  let lastError = "Transcription failed";

  for (const model of models) {
    try {
      const { raw, ok, errText } = await callGemini(
        model,
        key,
        input.mimeType?.trim() || "audio/wav",
        audioBase64,
        prompt,
      );
      if (!ok) {
        lastError = errText || lastError;
        if (errText && isModelNotFoundError(errText)) continue;
        continue;
      }
      const cues = parseCuesFromResponse(raw, maxDur, characterName || "Speaker 1");
      if (cues.length) {
        const arabicCues = normalizeDialogueCues(await ensureCuesArabic(cues), maxDur);
        return { cues: arabicCues, text: cuesToScript(arabicCues) };
      }
      lastError = "No speech detected in response";
    } catch {
      lastError = "Transcription failed";
    }
  }

  if (mode === "character" && characterName) {
    const fallback = await transcribeClipDialogue({
      ...input,
      mode: "all",
      characterName: "",
    });
    if (fallback.cues.length) {
      let picked = fallback.cues;
      if (typeof input.characterVoiceIndex === "number") {
        picked = filterCuesByVoiceIndex(fallback.cues, input.characterVoiceIndex);
      }
      const relabeled = relabelCuesSpeaker(
        normalizeDialogueCues(picked, maxDur),
        characterName,
      );
      if (relabeled.length) {
        const arabicCues = normalizeDialogueCues(await ensureCuesArabic(relabeled), maxDur);
        return {
          cues: arabicCues,
          text: cuesToScript(arabicCues),
          usedFallback: true,
        };
      }
    }
  }

  return { cues: [], text: "", error: friendlyTranscribeError(lastError, models) };
}

/** @deprecated */
export async function transcribeAudioToArabicSubtitle(
  audioBase64: string,
  mimeType = "audio/wav",
  clipDurationSec = 0,
  characterName = "",
): Promise<{ cues: DialogueCue[]; text: string; error?: string }> {
  return transcribeClipDialogue({
    audioBase64,
    mimeType,
    clipDurationSec,
    mode: characterName ? "character" : "all",
    characterName,
  });
}
