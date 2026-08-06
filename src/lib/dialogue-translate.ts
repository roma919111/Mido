import { hasArabic, isMostlyArabic } from "@/lib/prompt-translate";
import { GEMINI_AUDIO_MODEL_DEFAULT } from "@/lib/gemini-constants";
import { getGeminiApiKey } from "@/lib/gemini-video";

/** Translate dialogue/subtitle English → Modern Standard Arabic (server-side). */
export async function translateDialogueToArabic(
  input: string,
): Promise<{ text: string; translated: boolean; error?: string }> {
  const trimmed = input.trim();
  if (!trimmed) return { text: "", translated: false };
  if (isMostlyArabic(trimmed) || (hasArabic(trimmed) && !/[A-Za-z]{4,}/.test(trimmed))) {
    return { text: trimmed, translated: false };
  }

  const key = getGeminiApiKey();
  if (!key) {
    return {
      text: trimmed,
      translated: false,
      error: "Translation service unavailable",
    };
  }

  const model =
    process.env.GEMINI_TEXT_MODEL?.trim() ||
    process.env.GEMINI_AUDIO_MODEL?.trim() ||
    GEMINI_AUDIO_MODEL_DEFAULT;

  const prompt = `Translate the following video dialogue/subtitle into natural Modern Standard Arabic suitable for on-screen captions.
Output Arabic only. Keep names and brand terms readable. Return JSON only: {"text":"..."}.

Input:
${trimmed}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(18_000),
      },
    );
    if (!res.ok) {
      return { text: trimmed, translated: false, error: "Translation failed" };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = JSON.parse(raw) as { text?: string };
    const out = parsed.text?.trim();
    if (!out) return { text: trimmed, translated: false, error: "Empty translation" };
    return { text: out, translated: true };
  } catch {
    return { text: trimmed, translated: false, error: "Translation failed" };
  }
}
