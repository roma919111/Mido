/**
 * Polish creative prompts for Veronix generation.
 * Arabic input → Arabic cinematic polish; English input → English polish.
 */

import { resolveGeminiTextModel } from "@/lib/gemini-constants";

function envKey(name: string): string | undefined {
  try {
    return process.env[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Rough check: mostly Latin letters (English cinematic prompt). */
export function isMostlyEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (hasArabic(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z\u0600-\u06FF]/g, "");
  if (!letters.length) return false;
  const latin = (letters.match(/[A-Za-z]/g) || []).length;
  return latin / letters.length >= 0.85;
}

/** Enough Arabic letters to treat the prompt as Arabic-first. */
export function isMostlyArabic(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!hasArabic(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z\u0600-\u06FF]/g, "");
  if (!letters.length) return true;
  const arabic = (letters.match(/[\u0600-\u06FF]/g) || []).length;
  return arabic / letters.length >= 0.35;
}

function geminiKey(): string | null {
  return envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY") || null;
}

function openaiKey(): string | null {
  return envKey("OPENAI_API_KEY") || null;
}

async function geminiJsonText(prompt: string): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;
  const model = resolveGeminiTextModel();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(18_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
      null
    );
  } catch {
    return null;
  }
}

async function openaiJsonText(system: string, user: string): Promise<string | null> {
  const key = openaiKey();
  if (!key) return null;
  const model = envKey("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
  const base = (envKey("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function llmJson(
  geminiPrompt: string,
  openaiSystem: string,
  openaiUser: string,
): Promise<Record<string, unknown> | null> {
  const rawGemini = await geminiJsonText(geminiPrompt);
  if (rawGemini) {
    const parsed = parseJsonObject(rawGemini);
    if (parsed) return parsed;
  }
  const rawOpenAi = await openaiJsonText(openaiSystem, openaiUser);
  if (rawOpenAi) {
    const parsed = parseJsonObject(rawOpenAi);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Translate any user prompt to clear English for video generation.
 * Already-English text is returned lightly normalized.
 */
export async function translatePromptToEnglish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (isMostlyEnglish(trimmed) && !hasArabic(trimmed)) {
    return trimmed;
  }

  const geminiPrompt = `Translate the following creative prompt into natural cinematic English.
Keep every action, character name, place, wardrobe, and detail. Do not add new plot.
Output MUST be English only (Latin script). No Arabic characters.
Return JSON only: {"english":"..."}

TEXT:
${trimmed.slice(0, 4000)}`;

  const parsed = await llmJson(
    geminiPrompt,
    "You translate creative video/image prompts into natural cinematic English. Return JSON only.",
    geminiPrompt,
  );
  const en = typeof parsed?.english === "string" ? parsed.english.trim() : "";
  if (en.length >= 3 && isMostlyEnglish(en)) return en;

  // Last resort: if already mixed, strip nothing — caller will polish.
  return trimmed;
}

/**
 * Classic enhance polish: English scene → one cinematic AI prompt.
 * Customer-facing enhance text — do NOT inject "CGI" jargon.
 */
export async function polishPromptEnglish(
  text: string,
  opts?: {
    entities?: string[];
    setting?: string;
    media?: "image" | "video";
  },
): Promise<string> {
  const act = text.trim();
  if (!act) return "";

  const entityLine =
    opts?.entities && opts.entities.length
      ? `Characters/wardrobe: ${opts.entities.join("; ")}`
      : "";
  const settingLine = opts?.setting ? `Setting: ${opts.setting}` : "";
  const forImage = opts?.media === "image";

  const geminiPrompt = forImage
    ? `Polish this prompt into one rich cinematic AI image description in ENGLISH only.
Rules:
- Translate any non-English words to English first
- Keep every subject and detail from the source; do not invent a new scene
- Add AI enhancements: lighting, lens/composition, color grade, atmosphere, texture detail
- Natural photoreal / cinematic still look. Do NOT write CGI, 3D, render, or Unreal
- 2–4 sentences max
- Do not mention brand names or technical pipeline jargon
- Output MUST be English only (no Arabic)
Return JSON only: {"prompt":"..."}

SOURCE:
${act.slice(0, 4000)}
${entityLine}
${settingLine}`
    : `Polish this prompt into one rich cinematic AI video description (Seedance) in ENGLISH only.
Rules:
- Translate any non-English words to English first
- Keep every action and detail from the source; do not invent a new plot
- Add AI enhancements: camera move, pacing, lighting, atmosphere, natural motion, color grade
- Natural cinematic film look (live-action style). Do NOT write the words CGI, 3D, render, or Unreal
- 2–5 sentences max
- Do not mention brand names or technical pipeline jargon
- Output MUST be English only (no Arabic)
Return JSON only: {"prompt":"..."}

SOURCE:
${act.slice(0, 4000)}
${entityLine}
${settingLine}`;

  const parsed = await llmJson(
    geminiPrompt,
    "You rewrite creative prompts into rich cinematic English for AI video/image models. Return JSON only.",
    geminiPrompt,
  );
  const p = typeof parsed?.prompt === "string" ? parsed.prompt.trim() : "";
  if (p.length >= 12 && isMostlyEnglish(p)) return stripEnhanceJargon(p);

  // Deterministic English fallback when LLMs unavailable.
  const bits = [
    isMostlyEnglish(act) ? act : act,
    forImage
      ? "Rich color grade, soft cinematic lighting, intentional composition, sharp subject detail."
      : "Smooth natural motion, tracking camera, rich color grade, soft cinematic lighting.",
  ];
  if (entityLine) bits.push(entityLine);
  if (settingLine) bits.push(settingLine);
  const fallback = stripEnhanceJargon(bits.join(" "));
  // If source still Arabic and no LLM, mark clearly so UI can show error.
  if (hasArabic(fallback) && !geminiKey() && !openaiKey()) {
    return fallback;
  }
  return fallback;
}

/**
 * One-shot: AI enhance into a polished cinematic English prompt.
 */
export async function enhanceToEnglishCinematic(
  text: string,
  opts?: {
    entities?: string[];
    setting?: string;
    media?: "image" | "video";
  },
): Promise<{ prompt: string; translated: boolean; providerOk: boolean }> {
  const trimmed = text.trim();
  if (!trimmed) return { prompt: "", translated: false, providerOk: false };

  const forImage = opts?.media === "image";
  const entityLine =
    opts?.entities && opts.entities.length
      ? `Characters/wardrobe: ${opts.entities.join("; ")}`
      : "";
  const settingLine = opts?.setting ? `Setting: ${opts.setting}` : "";

  const geminiPrompt = `You are an expert prompt engineer for AI ${forImage ? "image" : "video"} generation.
Task: Convert the user's description into ONE polished cinematic English prompt.
Requirements:
1) Translate fully into natural English (Latin script only — no Arabic letters)
2) Keep every character, action, place, wardrobe, and detail from the source
3) Enrich with AI cinematic enhancements: lighting, camera, motion, atmosphere, color grade, composition
4) Do NOT invent a new story or change who does what
5) Do NOT write CGI, 3D, render, Unreal, or brand/pipeline jargon
6) ${forImage ? "2–4 sentences" : "2–5 sentences"}
Return JSON only: {"prompt":"...","english":true}

SOURCE:
${trimmed.slice(0, 4000)}
${entityLine}
${settingLine}`;

  const parsed = await llmJson(
    geminiPrompt,
    "You convert any-language creative prompts into rich cinematic English for AI generation. Return JSON only.",
    geminiPrompt,
  );
  const p = typeof parsed?.prompt === "string" ? parsed.prompt.trim() : "";
  if (p.length >= 12 && isMostlyEnglish(p)) {
    return {
      prompt: stripEnhanceJargon(p),
      translated: true,
      providerOk: true,
    };
  }

  // Two-step fallback.
  const english = await translatePromptToEnglish(trimmed);
  const polished = await polishPromptEnglish(english, opts);
  if (polished && isMostlyEnglish(polished)) {
    return {
      prompt: polished,
      translated: true,
      providerOk: Boolean(geminiKey() || openaiKey()),
    };
  }

  return {
    prompt: polished || english || trimmed,
    translated: isMostlyEnglish(polished || english),
    providerOk: Boolean(geminiKey() || openaiKey()),
  };
}

/**
 * Polish into cinematic Arabic — keep Arabic script for generation.
 * Used when the customer wrote Arabic (Improve Description + Generate).
 */
export async function enhanceToArabicCinematic(
  text: string,
  opts?: {
    entities?: string[];
    setting?: string;
    media?: "image" | "video";
  },
): Promise<{ prompt: string; translated: boolean; providerOk: boolean }> {
  const trimmed = text.trim();
  if (!trimmed) return { prompt: "", translated: false, providerOk: false };

  const forImage = opts?.media === "image";
  const entityLine =
    opts?.entities && opts.entities.length
      ? `الشخصيات/الملابس: ${opts.entities.join("؛ ")}`
      : "";
  const settingLine = opts?.setting ? `المكان: ${opts.setting}` : "";

  const geminiPrompt = `أنت خبير هندسة أوصاف لتوليد ${forImage ? "الصور" : "الفيديو"} بالذكاء الاصطناعي.
المهمة: حوّل وصف المستخدم إلى وصف سينمائي عربي واحد محسّن.
المتطلبات:
1) الناتج يجب أن يكون بالعربية الفصحى الواضحة (حروف عربية) — لا تترجم إلى الإنجليزية
2) حافظ على كل الشخصيات والأفعال والأماكن والملابس والتفاصيل من المصدر
3) أثرِ الوصف بإضاءة وكاميرا وحركة وأجواء وتدرجات لونية وتركيب سينمائي
4) لا تخترع قصة جديدة ولا تغيّر من يفعل ماذا
5) لا تكتب مصطلحات CGI أو 3D render أو Unreal أو أسماء علامات تقنية
6) ${forImage ? "جملتان إلى أربع جمل" : "جملتان إلى خمس جمل"}
أرجع JSON فقط: {"prompt":"...","arabic":true}

المصدر:
${trimmed.slice(0, 4000)}
${entityLine}
${settingLine}`;

  const parsed = await llmJson(
    geminiPrompt,
    "You rewrite creative prompts into rich cinematic Modern Standard Arabic for AI generation. Never translate to English. Return JSON only.",
    geminiPrompt,
  );
  const p = typeof parsed?.prompt === "string" ? parsed.prompt.trim() : "";
  if (p.length >= 8 && hasArabic(p)) {
    return {
      prompt: stripEnhanceJargon(p),
      translated: false,
      providerOk: true,
    };
  }

  return {
    prompt: trimmed,
    translated: false,
    providerOk: Boolean(geminiKey() || openaiKey()),
  };
}

/**
 * Language-aware enhance: Arabic stays Arabic; otherwise English cinematic.
 */
export async function enhanceToCinematic(
  text: string,
  opts?: {
    entities?: string[];
    setting?: string;
    media?: "image" | "video";
  },
): Promise<{
  prompt: string;
  language: "ar" | "en";
  translated: boolean;
  providerOk: boolean;
}> {
  if (isMostlyArabic(text) || (hasArabic(text) && !isMostlyEnglish(text))) {
    const ar = await enhanceToArabicCinematic(text, opts);
    return {
      prompt: ar.prompt,
      language: "ar",
      translated: false,
      providerOk: ar.providerOk,
    };
  }
  const en = await enhanceToEnglishCinematic(text, opts);
  return {
    prompt: en.prompt,
    language: "en",
    translated: en.translated,
    providerOk: en.providerOk,
  };
}

/** @deprecated alias — same as polishPromptEnglish */
export async function polishShotPromptEnglish(
  action: string,
  opts?: { entities?: string[]; setting?: string },
): Promise<string> {
  return polishPromptEnglish(action, opts);
}

/** Remove technical labels that confuse customers in the enhance box. */
function stripEnhanceJargon(text: string): string {
  return text
    .replace(/\bCGI\b/gi, "")
    .replace(/\b3D\s*render(?:ed|ing)?\b/gi, "")
    .replace(/\bUnreal(?:\s*Engine)?\b/gi, "")
    .replace(/\bdigital\s*film\s*look\b/gi, "film look")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}
