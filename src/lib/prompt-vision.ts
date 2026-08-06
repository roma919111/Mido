/**
 * Extract visual entities from uploaded reference / start-frame images
 * so prompt enhance can replace generic "man/woman" with concrete appearance.
 *
 * Uses an OpenAI-compatible vision chat API when configured:
 *   OPENAI_API_KEY (+ optional OPENAI_BASE_URL, OPENAI_VISION_MODEL)
 * or GEMINI_API_KEY (Google AI Studio).
 */

import { resolveGeminiVisionModel } from "@/lib/gemini-constants";

export type VisualEntity = {
  role: string;
  gender?: string;
  /** e.g. tall / short / average — critical for user prompts */
  heightBuild?: string;
  clothing?: string;
  colors?: string;
  skinTone?: string;
  hair?: string;
  features?: string;
  position?: string;
  /** Ready-to-inject noun phrase, e.g. "أنثى طويلة ترتدي ليغينغ تايغر" */
  summary: string;
};

export type VisionSceneBrief = {
  entities: VisualEntity[];
  setting?: string;
  arabicPreferred: boolean;
  source: "openai" | "gemini" | "none";
  rawText?: string;
};

/** Runtime env read — avoid Next build-time inlining of missing secrets. */
function env(name: string): string | undefined {
  try {
    return process.env[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function visionOpenAiConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
} | null {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: env("OPENAI_VISION_MODEL") || "gpt-4o-mini",
  };
}

function geminiKey(): string | null {
  return env("GEMINI_API_KEY") || env("GOOGLE_AI_API_KEY") || null;
}

export function hasVisionApiKey(): boolean {
  return Boolean(visionOpenAiConfig() || geminiKey());
}

function looksLikeImageBytes(buf: Buffer, mimeHint = ""): boolean {
  if (buf.length < 24) return false;
  // Reject HTML/JSON error pages disguised as image downloads.
  const head = buf.subarray(0, 64).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("{")) {
    return false;
  }
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isGif = buf.subarray(0, 3).toString("ascii") === "GIF";
  const isWebp =
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (isJpeg || isPng || isGif || isWebp) return true;
  return /^image\//i.test(mimeHint);
}

function decodeDataUrl(url: string): { mime: string; data: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(url);
  if (!m) return null;
  const mime = m[1] || "image/jpeg";
  const data = (m[2] || "").replace(/\s+/g, "");
  if (data.length < 64 || data.length > 6_000_000) return null;
  try {
    const bytes = Buffer.from(data, "base64");
    if (!looksLikeImageBytes(bytes, mime)) return null;
    return { mime, data, bytes };
  } catch {
    return null;
  }
}

const VISION_INSTRUCTION = `You analyze reference image(s) for video prompt writing.
Return STRICT JSON only (no markdown) with this shape:
{
  "entities": [
    {
      "role": "person_a|person_b|subject",
      "gender": "male|female|unknown",
      "heightBuild": "tall|short|average + body note if obvious",
      "clothing": "exact garments visible (e.g. tiger-print leggings, white t-shirt)",
      "colors": "main clothing colors/patterns",
      "skinTone": "brief",
      "hair": "brief",
      "features": "distinctive visible traits",
      "position": "left|right|center|foreground|background",
      "summary": "ONE injectable noun phrase — MUST include gender word + height/build + clothing"
    }
  ],
  "setting": "short setting description",
  "arabicPreferred": true
}
Rules:
- Identify each distinct person separately (left/right, larger/smaller, order).
- summary examples (Arabic when arabicPreferred):
  - "أنثى طويلة ترتدي ليغينغ تايغر"
  - "رجل قصير يرتدي قميصاً"
- summary examples (English otherwise):
  - "a tall woman wearing tiger-print leggings"
  - "a short man wearing a t-shirt"
- NEVER use vague summaries like "الشخصية الظاهرة في الصورة" or "the person in the image".
- Prefer concrete garments, patterns, and relative height.
- Max 4 entities. Ignore tiny background extras.
- Match user hint language: if the hint is Arabic, arabicPreferred=true and write summary in Arabic.`;

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
          .map((e, i) => {
            const entity: VisualEntity = {
              role: String(e.role || `person_${i + 1}`),
              gender: e.gender ? String(e.gender) : undefined,
              heightBuild: (e as VisualEntity).heightBuild
                ? String((e as VisualEntity).heightBuild)
                : undefined,
              clothing: e.clothing ? String(e.clothing) : undefined,
              colors: e.colors ? String(e.colors) : undefined,
              skinTone: e.skinTone ? String(e.skinTone) : undefined,
              hair: e.hair ? String(e.hair) : undefined,
              features: e.features ? String(e.features) : undefined,
              position: e.position ? String(e.position) : undefined,
              summary: String(e.summary || "").trim(),
            };
            entity.summary = buildConcreteEntityPhrase(entity, Boolean(parsed.arabicPreferred));
            return entity;
          })
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
    // OpenAI accepts https URLs and data: URLs.
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
  const model = resolveGeminiVisionModel();

  const parts: Array<Record<string, unknown>> = [
    { text: `${VISION_INSTRUCTION}\nUser action hint: ${userHint || "(none)"}` },
  ];

  for (const url of imageUrls.slice(0, 2)) {
    try {
      if (url.startsWith("data:")) {
        const decoded = decodeDataUrl(url);
        if (!decoded) continue;
        parts.push({
          inline_data: { mime_type: decoded.mime, data: decoded.data },
        });
        continue;
      }
      const imgRes = await fetch(url, {
        redirect: "follow",
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (compatible; VyronixPromptVision/1.1; +https://vyronix.app)",
        },
      });
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 200 || buf.length > 4_500_000) continue;
      const mimeHint =
        imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
      if (!looksLikeImageBytes(buf, mimeHint)) continue;
      const mime = mimeHint.startsWith("image/") ? mimeHint : "image/jpeg";
      parts.push({
        inline_data: {
          mime_type: mime,
          data: buf.toString("base64"),
        },
      });
    } catch {
      // skip unreadable url
    }
  }
  if (parts.length < 2) {
    throw new Error("Could not load reference image bytes for Gemini vision");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
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
  const urls = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))]
    .filter((u) => !(u.startsWith("data:") && u.length > 400_000))
    .slice(0, 2);
  if (!urls.length) return null;

  const cacheKey = urls.slice().sort().join("|");
  const hit = briefCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.brief;

  const empty: VisionSceneBrief = {
    entities: [],
    arabicPreferred: /[\u0600-\u06FF]/.test(userHint),
    source: "none",
  };

  const run = async (): Promise<VisionSceneBrief> => {
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
        console.warn("[prompt-vision]", lastError.message);
      }
      return empty;
    }
    briefCache.set(cacheKey, { at: Date.now(), brief });
    return brief;
  };

  // Never let vision hang the whole enhance request.
  return Promise.race([
    run(),
    new Promise<VisionSceneBrief>((resolve) =>
      setTimeout(() => resolve(empty), 12_000),
    ),
  ]);
}

/** Build an injectable phrase from structured vision fields. */
export function buildConcreteEntityPhrase(entity: VisualEntity, arabic: boolean): string {
  const vague =
    !entity.summary ||
    /الصورة المرجعية|reference image|الشخصية الظاهرة|the (?:exact )?character|person in the image/i.test(
      entity.summary,
    );

  if (!vague && entity.summary.trim().length >= 10) {
    return entity.summary.trim();
  }

  const gender = String(entity.gender || "").toLowerCase();
  const clothing = [entity.clothing, entity.colors].filter(Boolean).join(" ").trim();
  const height = String(entity.heightBuild || entity.features || "").trim();

  if (arabic) {
    const female = gender.startsWith("f") || gender === "female";
    const male = gender.startsWith("m") || gender === "male";
    const who = female ? "أنثى" : male ? "رجل" : "شخص";
    const size = /tall|طويل/i.test(height)
      ? female
        ? "طويلة"
        : "طويل"
      : /short|قصير/i.test(height)
        ? female
          ? "قصيرة"
          : "قصير"
        : "";
    let wear = "";
    if (clothing) {
      const c = clothing.replace(/^(ترتدي|يرتدي|wearing)\s+/i, "").trim();
      wear = female ? `ترتدي ${c}` : `يرتدي ${c}`;
    }
    return [who, size, wear].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  const who =
    gender.startsWith("f") || gender === "female"
      ? "woman"
      : gender.startsWith("m") || gender === "male"
        ? "man"
        : "person";
  const size = /tall|طويل/i.test(height)
    ? "tall"
    : /short|قصير/i.test(height)
      ? "short"
      : "";
  const wear = clothing ? `wearing ${clothing}` : "";
  return ["a", size, who, wear].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function entityPhrasesFromBrief(brief: VisionSceneBrief | null | undefined): {
  phrases: string[];
  genders: Array<"female" | "male" | "unknown">;
} {
  if (!brief?.entities?.length) return { phrases: [], genders: [] };
  const arabic = brief.arabicPreferred;
  const phrases: string[] = [];
  const genders: Array<"female" | "male" | "unknown"> = [];
  for (const e of brief.entities.slice(0, 4)) {
    const phrase = buildConcreteEntityPhrase(e, arabic);
    if (!phrase) continue;
    phrases.push(phrase);
    const g = String(e.gender || "").toLowerCase();
    genders.push(
      g.startsWith("f") || g === "female"
        ? "female"
        : g.startsWith("m") || g === "male"
          ? "male"
          : "unknown",
    );
  }
  return { phrases, genders };
}

export function formatEntityBrief(brief: VisionSceneBrief | null | undefined, arabic: boolean): string {
  if (!brief?.entities?.length) return "";
  return brief.entities
    .map((e, i) => {
      const phrase = buildConcreteEntityPhrase(e, arabic);
      return arabic ? `الشخصية ${i + 1}: ${phrase}` : `Character ${i + 1}: ${phrase}`;
    })
    .join(arabic ? "؛ " : "; ");
}
