/**
 * Translate user prompts to English for Seedance / BytePlus generation,
 * and polish each action beat into a cinematic one-shot description.
 */

function envKey(name: string): string | undefined {
  try {
    return process.env[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function geminiKey(): string | null {
  return envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY") || null;
}

async function geminiJsonText(prompt: string): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;
  const model = envKey("GEMINI_VISION_MODEL") || "gemini-flash-lite-latest";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(14_000),
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

/**
 * Translate any user prompt to clear English for video generation.
 * Already-English text is returned lightly normalized.
 */
export async function translatePromptToEnglish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (!hasArabic(trimmed) && !/[^\x00-\x7F]/.test(trimmed)) {
    return trimmed;
  }

  const raw = await geminiJsonText(
    `Translate the following video prompt into natural cinematic English.
Keep every action, character, place, and detail. Do not add new plot.
Return JSON only: {"english":"..."}

TEXT:
${trimmed.slice(0, 4000)}`,
  );
  if (raw) {
    const parsed = parseJsonObject(raw);
    const en = typeof parsed?.english === "string" ? parsed.english.trim() : "";
    if (en.length >= 3) return en;
  }

  // Fallback: strip common Arabic wrappers; caller will still enhance.
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

  const raw = await geminiJsonText(
    forImage
      ? `Polish this English image prompt into one cinematic AI image description.
Rules:
- Keep every subject and detail from the source; do not invent a new scene
- Natural photoreal / cinematic still look. Do NOT write CGI, 3D, render, or Unreal
- Include lighting, composition, and mood
- 2–4 sentences max
- Do not mention brand names or technical pipeline jargon
Return JSON only: {"prompt":"..."}

SOURCE:
${act.slice(0, 4000)}
${entityLine}
${settingLine}`
      : `Polish this English video prompt into one cinematic AI video description (Seedance).
Rules:
- Keep every action and detail from the source; do not invent a new plot
- Natural cinematic film look (live-action style). Do NOT write the words CGI, 3D, render, or Unreal
- Include lighting, camera, and natural motion
- 2–5 sentences max
- Do not mention brand names or technical pipeline jargon
Return JSON only: {"prompt":"..."}

SOURCE:
${act.slice(0, 4000)}
${entityLine}
${settingLine}`,
  );
  if (raw) {
    const parsed = parseJsonObject(raw);
    const p = typeof parsed?.prompt === "string" ? parsed.prompt.trim() : "";
    if (p.length >= 12) return stripEnhanceJargon(p);
  }

  const bits = [
    act,
    forImage
      ? "Rich color grade, soft cinematic lighting, intentional composition."
      : "Smooth natural motion, rich color grade, soft cinematic lighting.",
  ];
  if (entityLine) bits.push(entityLine);
  if (settingLine) bits.push(settingLine);
  return stripEnhanceJargon(bits.join(" "));
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
