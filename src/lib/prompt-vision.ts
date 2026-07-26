/**
 * Extract visual entities from uploaded reference / start-frame images
 * so prompt enhance can replace generic "man/woman" with concrete appearance.
 *
 * Uses an OpenAI-compatible vision chat API when configured:
 *   OPENAI_API_KEY (+ optional OPENAI_BASE_URL, OPENAI_VISION_MODEL)
 * or GEMINI_API_KEY (Google AI Studio).
 */

export type VisualEntity = {
  role: string;
  gender?: string;
  clothing?: string;
  colors?: string;
  skinTone?: string;
  hair?: string;
  features?: string;
  position?: string;
  summary: string;
};

export type VisionSceneBrief = {
  entities: VisualEntity[];
  setting?: string;
  arabicPreferred: boolean;
  source: "openai" | "gemini" | "none";
  rawText?: string;
};

function visionOpenAiConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
} | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    ),
    model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
  };
}

function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || null;
}

const VISION_INSTRUCTION = `You analyze reference image(s) for video prompt writing.
Return STRICT JSON only (no markdown) with this shape:
{
  "entities": [
    {
      "role": "person_a|person_b|subject|animal|object",
      "gender": "male|female|unknown",
      "clothing": "short clothing description",
      "colors": "main clothing/colors",
      "skinTone": "brief",
      "hair": "brief",
      "features": "distinctive visible traits",
      "position": "left|right|center|foreground|background",
      "summary": "one Arabic or English noun phrase identifying this entity uniquely"
    }
  ],
  "setting": "short setting description",
  "arabicPreferred": true
}
Rules:
- Identify each distinct person separately (left/right/order of appearance).
- Prefer concrete clothing colors and garments over vague words.
- If text in the user locale seems Arabic-heavy from context, set arabicPreferred true.
- Max 4 entities. Ignore tiny background extras.`;

function parseVisionJson(text: string): VisionSceneBrief | null {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      entities?: VisualEntity[];
      setting?: string;
      arabicPreferred?: boolean;
    };
    const entities = Array.isArray(parsed.entities)
      ? parsed.entities
          .filter((e) => e && typeof e.summary === "string" && e.summary.trim())
          .slice(0, 4)
          .map((e, i) => ({
            role: String(e.role || `person_${i + 1}`),
            gender: e.gender ? String(e.gender) : undefined,
            clothing: e.clothing ? String(e.clothing) : undefined,
            colors: e.colors ? String(e.colors) : undefined,
            skinTone: e.skinTone ? String(e.skinTone) : undefined,
            hair: e.hair ? String(e.hair) : undefined,
            features: e.features ? String(e.features) : undefined,
            position: e.position ? String(e.position) : undefined,
            summary: String(e.summary).trim(),
          }))
      : [];
    if (!entities.length) return null;
    return {
      entities,
      setting: parsed.setting ? String(parsed.setting) : undefined,
      arabicPreferred: Boolean(parsed.arabicPreferred),
      source: "openai",
      rawText: cleaned.slice(0, 2000),
    };
  } catch {
    return null;
  }
}

async function analyzeWithOpenAi(
  imageUrls: string[],
  userHint: string,
): Promise<VisionSceneBrief | null> {
  const cfg = visionOpenAiConfig();
  if (!cfg) return null;

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `${VISION_INSTRUCTION}\nUser action hint: ${userHint || "(none)"}` },
  ];
  for (const url of imageUrls.slice(0, 2)) {
    content.push({
      type: "image_url",
      image_url: { url, detail: "low" },
    });
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Vision API failed (${res.status}): ${errText.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content || "";
  const parsed = parseVisionJson(text);
  if (!parsed) return null;
  return { ...parsed, source: "openai" };
}

async function analyzeWithGemini(
  imageUrls: string[],
  userHint: string,
): Promise<VisionSceneBrief | null> {
  const key = geminiKey();
  if (!key) return null;
  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash";

  const parts: Array<Record<string, unknown>> = [
    { text: `${VISION_INSTRUCTION}\nUser action hint: ${userHint || "(none)"}` },
  ];

  for (const url of imageUrls.slice(0, 2)) {
    const imgRes = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "image/*", "User-Agent": "VyronixPromptVision/1.0" },
    });
    if (!imgRes.ok) continue;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 200 || buf.length > 4_500_000) continue;
    const mime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    parts.push({
      inline_data: {
        mime_type: mime,
        data: buf.toString("base64"),
      },
    });
  }
  if (parts.length < 2) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini vision failed (${res.status}): ${errText.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const parsed = parseVisionJson(text);
  if (!parsed) return null;
  return { ...parsed, source: "gemini" };
}

/** In-memory brief cache keyed by sorted image URLs. */
const briefCache = new Map<string, { at: number; brief: VisionSceneBrief }>();
const CACHE_TTL_MS = 1000 * 60 * 30;

export async function analyzeReferenceImages(
  imageUrls: string[],
  userHint = "",
): Promise<VisionSceneBrief | null> {
  const urls = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))].slice(0, 2);
  if (!urls.length) return null;

  const cacheKey = urls.slice().sort().join("|");
  const hit = briefCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.brief;

  let brief: VisionSceneBrief | null = null;
  let lastError: Error | null = null;

  if (visionOpenAiConfig()) {
    try {
      brief = await analyzeWithOpenAi(urls, userHint);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("OpenAI vision failed");
    }
  }
  if (!brief && geminiKey()) {
    try {
      brief = await analyzeWithGemini(urls, userHint);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Gemini vision failed");
    }
  }

  if (!brief) {
    if (lastError) {
      // Soft-fail: enhance can continue without vision.
      console.warn("[prompt-vision]", lastError.message);
    }
    return {
      entities: [],
      arabicPreferred: /[\u0600-\u06FF]/.test(userHint),
      source: "none",
    };
  }

  briefCache.set(cacheKey, { at: Date.now(), brief });
  return brief;
}

export function formatEntityBrief(brief: VisionSceneBrief | null | undefined, arabic: boolean): string {
  if (!brief?.entities?.length) return "";
  if (arabic) {
    return brief.entities
      .map((e, i) => {
        const bits = [
          e.summary,
          e.clothing,
          e.colors ? `ألوان: ${e.colors}` : "",
          e.skinTone ? `بشرة: ${e.skinTone}` : "",
          e.hair ? `شعر: ${e.hair}` : "",
          e.position ? `موقع: ${e.position}` : "",
        ].filter(Boolean);
        return `الشخصية ${i + 1}: ${bits.join(" · ")}`;
      })
      .join("؛ ");
  }
  return brief.entities
    .map((e, i) => {
      const bits = [
        e.summary,
        e.clothing,
        e.colors ? `colors: ${e.colors}` : "",
        e.skinTone ? `skin: ${e.skinTone}` : "",
        e.hair ? `hair: ${e.hair}` : "",
        e.position ? `position: ${e.position}` : "",
      ].filter(Boolean);
      return `Character ${i + 1}: ${bits.join(" · ")}`;
    })
    .join("; ");
}
