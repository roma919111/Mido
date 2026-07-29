/**
 * Veronix timed shot script
 * Cycle per unique action (no verb repeats):
 *   فعل (2ث) → حالة الفاعل بالاسم (1ث) → حالة المفعول به بالاسم (1ث)
 *
 * Labels never say «حالة الفاعل/المفعول به» — they start with the character name.
 */

import {
  countActionVerbs,
  splitActionClauses,
} from "@/lib/prompt-chain";
import { hasArabic, isMostlyArabic } from "@/lib/prompt-translate";

export type ShotRole = "action" | "subject_state" | "object_state";

export type TimedBeat = {
  index: number;
  startSec: number;
  endSec: number;
  role: ShotRole;
  /** Shown in the confirm sheet (character name first for states). */
  labelAr: string;
  /** Line inside the generation script */
  text: string;
};

export type ActionTriple = {
  action: string;
  /** e.g. «دانو تبتسم بثقة وهي تمشي» — no role prefix */
  subject: string;
  /** e.g. «ميدو منهك لا يستطيع الحراك» — no role prefix */
  object: string;
};

export type VeronixShotScript = {
  beats: TimedBeat[];
  scriptPrompt: string;
  summaryAr: string;
  totalSeconds: number;
};

const ACTION_SECONDS = 2;
const SUBJECT_SECONDS = 1;
const OBJECT_SECONDS = 1;
const CYCLE = ACTION_SECONDS + SUBJECT_SECONDS + OBJECT_SECONDS; // 4

export const SHOT_CYCLE_SECONDS = CYCLE;

function envKey(name: string): string | undefined {
  try {
    return process.env[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function cleanCore(prompt: string): string {
  return (prompt || "")
    .replace(/^مشهد سينمائي واقعي:\s*/i, "")
    .replace(/^Cinematic realistic (?:scene|image):\s*/i, "")
    .replace(/^\[?\s*(?:لقطة|Shot)\s*\d+\s*\]?\s*[:：\-]?\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 3) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function stripRolePrefixes(text: string): string {
  return text
    .replace(/^حالة\s*الفاعل\s*[:：\-]?\s*/u, "")
    .replace(/^حالة\s*المفعول\s*به\s*[:：\-]?\s*/u, "")
    .replace(/^النتيجة\s*(?:\/\s*رد[ّ]?ة\s*الفعل)?\s*[:：\-]?\s*/u, "")
    .replace(/^Subject(?:'s)?\s*state\s*[:：\-]?\s*/i, "")
    .replace(/^Object(?:'s)?\s*state\s*[:：\-]?\s*/i, "")
    .replace(/^Result\s*(?:\/\s*reaction)?\s*[:：\-]?\s*/i, "")
    .trim();
}

function trimAtmospherePrefix(text: string): string {
  return text
    .replace(/^في\s+مشهد\s+سينمائي[^،.]{0,120}،\s*/u, "")
    .replace(/^In\s+a\s+cinematic[^,]{0,120},\s*/i, "")
    .replace(/^تظهر\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAtmosphereOnly(text: string, arabic: boolean): boolean {
  if (countActionVerbs(text, arabic) >= 1) return false;
  if (arabic) {
    return /إضاءة|تدرجات|أجواء|كاميرا|زاوية\s+واسعة|مشهد\s+سينمائي|غروب/.test(
      text,
    );
  }
  return /\b(lighting|cinematic|atmosphere|camera|wide\s+angle|sunset)\b/i.test(
    text,
  );
}

function preferVerbSegment(text: string, arabic: boolean): string {
  const t = text.trim();
  if (t.length < 40) return t;
  if (arabic) {
    const m = t.match(
      /((?:تسدد|ترفع|ترمي|تقذف|تمسك|تؤدي|تضرب|تقفل|تلف|تسقط|تمشي|تتمشى|تجلس|تحمل|تقفز|تدفع|تسحب|تركل|يرفع|يرمي|يقذف|يمسك|يسقط|يمشي|يحمل|يقفز)[^]*)$/u,
    );
    if (m?.[1] && m[1].length >= 8 && m[1].length < t.length) {
      return m[1].trim();
    }
  }
  return t;
}

function shortenAction(action: string): string {
  // Keep written events in the same sentence. Only strip atmosphere / side clauses.
  return trimAtmospherePrefix(action)
    .replace(/\s+بينما\s+.*/u, "")
    .replace(/\s+و\s*بينما\s+.*/u, "")
    .replace(/\s+تحرك(?:ت|ين)?\s+الكاميرا.*/u, "")
    .replace(/\s+يتزامن\s+ذلك\s+مع.*/u, "")
    .replace(/\s+/g, " ")
    .replace(/[،,\s]+$/u, "")
    .trim()
    .slice(0, 140);
}

/** Polished action must still reflect the locked source action (no new verbs). */
function actionGroundedInSource(polished: string, locked: string): boolean {
  const a = polished.replace(/\s+/g, " ").trim();
  const b = locked.replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) || a.includes(b.slice(0, Math.min(24, b.length)))) return true;
  const tokens = (s: string) =>
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3);
  const bt = new Set(tokens(b));
  const at = tokens(a);
  if (!at.length || !bt.size) return false;
  const hit = at.filter((t) => bt.has(t)).length;
  return hit / Math.min(at.length, bt.size) >= 0.34;
}

/**
 * Actions literally written in the customer text only.
 * Split on sequence markers / sentences — do NOT invent verbs or over-split every verb.
 */
export function extractActionBeats(prompt: string): string[] {
  const core = cleanCore(prompt);
  if (!core) return [];
  const arabic = hasArabic(core);

  // 1) ثم / then …  2) sentence boundaries — never splitByActionVerbs (inflates duration).
  const sequenced = splitActionClauses(core, arabic)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);
  const clauses: string[] = [];
  for (const block of sequenced.length ? sequenced : [core]) {
    const sentences = block
      .split(/(?<=[.!?؟。])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);
    if (sentences.length > 1) clauses.push(...sentences);
    else clauses.push(block);
  }

  const withVerbs = clauses.filter((c) => countActionVerbs(c, arabic) >= 1);
  const pool = withVerbs.length ? withVerbs : clauses;

  const actions = pool
    .map((c) => trimAtmospherePrefix(c))
    .filter((c) => c.length >= 4 && !isAtmosphereOnly(c, arabic))
    .map((c) => preferVerbSegment(c, arabic))
    .map(shortenAction)
    .map((c) => c.trim())
    .filter((c) => {
      if (c.length < 4) return false;
      return (
        actionGroundedInSource(c, core) ||
        core.includes(c.slice(0, Math.min(16, c.length)))
      );
    });

  const unique = uniqKeepOrder(actions).slice(0, 8);
  if (!unique.length) {
    const one = shortenAction(core) || core.slice(0, 110);
    return one ? [one] : [];
  }
  return unique;
}

/** Guess two character display names from the prompt (فاعل / مفعول به). */
export function guessCharacterNames(prompt: string): {
  subject: string;
  object: string;
} {
  const core = cleanCore(prompt);
  const arabic = hasArabic(core);
  if (arabic) {
    const names = [
      ...core.matchAll(
        /(?:^|[\s،,])((?:دانو|ميدو|دانية|أحمد|محمد|سارة|ليان|نور|ريم|عمر|خالد|يوسف|لينا|ميا|علي|حسن|فاطمة|زينب)(?:\w*)?)/gu,
      ),
    ]
      .map((m) => m[1]!.trim())
      .filter(Boolean);
    const uniq = uniqKeepOrder(names);
    if (uniq.length >= 2) {
      return { subject: uniq[0]!, object: uniq[1]! };
    }
    if (uniq.length === 1) {
      return { subject: uniq[0]!, object: "الشخصية الأخرى" };
    }
    return { subject: "الفاعل", object: "المفعول به" };
  }
  const en = [
    ...core.matchAll(/\b([A-Z][a-z]{2,20})\b/g),
  ].map((m) => m[1]!);
  const uniq = uniqKeepOrder(en);
  if (uniq.length >= 2) return { subject: uniq[0]!, object: uniq[1]! };
  if (uniq.length === 1) return { subject: uniq[0]!, object: "the other character" };
  return { subject: "the lead", object: "the partner" };
}

function inventSubjectState(
  action: string,
  subjectName: string,
  arabic: boolean,
): string {
  const a = action;
  if (arabic) {
    if (/ترم[يى]|تقذف|يرم[يى]|يقذف/.test(a)) {
      return `${subjectName} بقوة وتركيز وهي تقذف للأعلى`;
    }
    if (/وقفة\s*يدين|انشقاق|handstand|تؤدي/.test(a)) {
      return `${subjectName} ثابتة في وقفة اليدين بانشقاق أفقي وجسد مشدود`;
    }
    if (/تتمشى|تمشي|تحمل|حاملة/.test(a)) {
      return `${subjectName} تبتسم بثقة وثبات أثناء الحمل`;
    }
    if (/تلف|مقص/.test(a)) {
      return `${subjectName} محكمة السيطرة بثبات تام`;
    }
    return `${subjectName} بملامح واثقة وحضور سينمائي واضح`;
  }
  if (/throw|toss|fling/i.test(a)) {
    return `${subjectName} focused and powerful in the throw`;
  }
  if (/handstand|split/i.test(a)) {
    return `${subjectName} locked in a perfect handstand, body taut`;
  }
  if (/walk|carr/i.test(a)) {
    return `${subjectName} smiling with confident composure`;
  }
  return `${subjectName} with clear cinematic presence`;
}

function inventObjectState(
  action: string,
  objectName: string,
  arabic: boolean,
): string {
  const a = action;
  if (arabic) {
    if (/ترم[يى]|تقذف|يرم[يى]|يقذف/.test(a)) {
      return `${objectName} في الهواء مرتخي الجسد بعد القذف`;
    }
    if (/وقفة\s*يدين|انشقاق|يسقط|سقوط|ممدد/.test(a)) {
      return `${objectName} يسقط ممدداً على بطنه فوق منتصف الساقين`;
    }
    if (/تتمشى|تمشي|تحمل|حاملة/.test(a)) {
      return `${objectName} منهك لا يستطيع الحراك على الكتفين`;
    }
    if (/تلف|مقص/.test(a)) {
      return `${objectName} محصور بين الساقين في وضعية المقص`;
    }
    return `${objectName} متأثر بالحركة مع تعبير واضح`;
  }
  if (/throw|toss|fling/i.test(a)) {
    return `${objectName} airborne and limp after the throw`;
  }
  if (/handstand|split|fall|lands/i.test(a)) {
    return `${objectName} landing belly-down across the legs`;
  }
  if (/walk|carr/i.test(a)) {
    return `${objectName} exhausted and unable to move on the shoulders`;
  }
  return `${objectName} visibly affected by the motion`;
}

/** Local chronological triples — one subject/object state per action (no cross-reuse). */
export function planShotTriplesLocal(prompt: string): ActionTriple[] {
  const core = cleanCore(prompt);
  const arabic = hasArabic(core);
  const actions = extractActionBeats(core);
  const names = guessCharacterNames(core);
  const list = (actions.length ? actions : [shortenAction(core) || core]).slice(
    0,
    8,
  );

  return list.map((action) => ({
    action,
    subject: inventSubjectState(action, names.subject, arabic),
    object: inventObjectState(action, names.object, arabic),
  }));
}

async function geminiJson(prompt: string): Promise<Record<string, unknown> | null> {
  const key = envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY");
  if (!key) return null;
  const model =
    envKey("GEMINI_TEXT_MODEL") ||
    envKey("GEMINI_VISION_MODEL") ||
    "gemini-flash-lite-latest";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(22_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
      "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function openaiJson(
  system: string,
  user: string,
): Promise<Record<string, unknown> | null> {
  const key = envKey("OPENAI_API_KEY");
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(22_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Polished action must still reflect the locked source action (no new verbs). */
function actionGroundedInLocked(polished: string, locked: string): boolean {
  return actionGroundedInSource(polished, locked);
}

function normalizeTriples(
  raw: unknown,
  lockedActions: string[],
  fallbackPrompt: string,
): ActionTriple[] | null {
  if (!raw || typeof raw !== "object") return null;
  const beats = (raw as { beats?: unknown }).beats;
  if (!Array.isArray(beats) || !beats.length) return null;

  const byIndex: ActionTriple[] = [];
  for (let i = 0; i < lockedActions.length; i += 1) {
    const locked = lockedActions[i]!;
    const row =
      beats[i] && typeof beats[i] === "object"
        ? (beats[i] as Record<string, unknown>)
        : null;
    const polishedAction = row ? String(row.action || "").trim() : "";
    const subject = row
      ? stripRolePrefixes(String(row.subject || row.actor || "").trim())
      : "";
    const object = row
      ? stripRolePrefixes(String(row.object || row.patient || "").trim())
      : "";

    const action =
      polishedAction && actionGroundedInLocked(polishedAction, locked)
        ? shortenAction(polishedAction) || locked
        : locked;

    const arabic = hasArabic(fallbackPrompt);
    const names = guessCharacterNames(fallbackPrompt);
    byIndex.push({
      action,
      subject: subject || inventSubjectState(action, names.subject, arabic),
      object: object || inventObjectState(action, names.object, arabic),
    });
  }
  return byIndex.length ? byIndex : null;
}

/**
 * 1) Lock actions to verbs literally present in the customer text (local extract).
 * 2) AI polishes EACH locked shot only (action / subject / object) — never adds actions.
 */
export async function planShotTriplesAi(prompt: string): Promise<ActionTriple[]> {
  const source = cleanCore(prompt);
  if (!source) return [];
  const arabic = isMostlyArabic(source) || hasArabic(source);
  const lockedActions = extractActionBeats(source);
  const local = planShotTriplesLocal(source);
  if (!lockedActions.length) return local;

  const listed = lockedActions
    .map((a, i) => `${i + 1}) ${a}`)
    .join("\n");

  const instruction = arabic
    ? `أنت محرّر أوصاف فيرونيكس. هذه هي الأفعال الوحيدة المسموحة — مأخوذة حرفياً من نص الزبون. عددها ثابت ولا يجوز إضافة فعل جديد.

الأفعال المقفلة (بالترتيب):
${listed}

لكل فعل مقفل بالفهرس نفسه أخرج تحسيناً سينمائياً لثلاث حقول:
- action: حسّن صياغة نفس الفعل فقط (لا تغيّر معناه ولا تضف حدثاً جديداً)
- subject: حالة الفاعل تبدأ باسم الشخصية (بدون كلمة «حالة الفاعل»)
- object: حالة المفعول به تبدأ باسم الشخصية (بدون كلمة «حالة المفعول به»)

قواعد صارمة:
1) عدد العناصر في beats يجب أن يساوي بالضبط ${lockedActions.length}
2) beats[i] يخص الفعل المقفول رقم i+1 فقط
3) ممنوع اختراع أفعال أو لقطات إضافية
4) إن لم تُذكر حالة الفاعل/المفعول به في النص، حسّنها بالذكاء الاصطناعي لتناسب هذا الفعل فقط
5) JSON فقط: {"beats":[{"action":"...","subject":"...","object":"..."}]}

نص المشهد الأصلي (مرجع فقط):
${source.slice(0, 4000)}`
    : `You are a Veronix copy editor. These are the ONLY allowed actions — taken from the customer's text. Count is fixed; you must NOT invent new actions.

Locked actions (in order):
${listed}

For each locked action at the same index, return a cinematic polish of three fields:
- action: polish THE SAME action only (do not change meaning or add a new event)
- subject: actor state starting with the character name (no "subject state:" prefix)
- object: patient state starting with the character name (no "object state:" prefix)

Hard rules:
1) beats length MUST equal exactly ${lockedActions.length}
2) beats[i] belongs only to locked action #i+1
3) Never invent extra actions/shots
4) If subject/object state is missing, invent AI cinematic detail for THIS action only
5) JSON only: {"beats":[{"action":"...","subject":"...","object":"..."}]}

Original scene (reference only):
${source.slice(0, 4000)}`;

  const parsed =
    (await geminiJson(instruction)) ||
    (await openaiJson(
      "Polish locked cinematic shot triples only. Never add actions. Return JSON only.",
      instruction,
    ));

  const triples = normalizeTriples(parsed, lockedActions, source);
  if (triples?.length === lockedActions.length) return triples;
  // Fallback: local triples already locked to extractActionBeats.
  return local.slice(0, lockedActions.length);
}

export function packTriplesToScript(
  triples: ActionTriple[],
  input: {
    sceneCore: string;
    minSeconds?: number;
    maxSeconds?: number;
  },
): VeronixShotScript {
  const arabic = hasArabic(input.sceneCore) || triples.some((t) => hasArabic(t.action));
  const minSec = Math.max(1, Math.floor(input.minSeconds || 4));
  const maxSec = Math.max(minSec, Math.floor(input.maxSeconds || 15));
  const cycleCount = Math.max(1, triples.length);
  const totalSeconds = Math.min(maxSec, Math.max(minSec, cycleCount * CYCLE));

  const beats: TimedBeat[] = [];
  let t = 0;

  for (let i = 0; i < triples.length && t < totalSeconds; i += 1) {
    const triple = triples[i]!;
    const remaining = totalSeconds - t;
    const slots: Array<{ role: ShotRole; want: number; line: string }> = [
      {
        role: "action",
        want: Math.min(ACTION_SECONDS, remaining),
        line: stripRolePrefixes(triple.action),
      },
      {
        role: "subject_state",
        want: Math.min(SUBJECT_SECONDS, Math.max(0, remaining - ACTION_SECONDS)),
        line: stripRolePrefixes(triple.subject),
      },
      {
        role: "object_state",
        want: Math.min(
          OBJECT_SECONDS,
          Math.max(0, remaining - ACTION_SECONDS - SUBJECT_SECONDS),
        ),
        line: stripRolePrefixes(triple.object),
      },
    ];

    for (const slot of slots) {
      if (slot.want < 1 || t >= totalSeconds) continue;
      const startSec = t;
      const endSec = Math.min(totalSeconds, t + slot.want);
      if (endSec <= startSec) continue;
      beats.push({
        index: beats.length + 1,
        startSec,
        endSec,
        role: slot.role,
        labelAr: slot.line,
        text: slot.line,
      });
      t = endSec;
    }
  }

  const timelineAr = beats
    .map((b) => `لقطة ${b.index}: ${b.startSec}–${b.endSec}ث — ${b.labelAr}`)
    .join("\n");

  const timelineEn = beats
    .map((b) => `Shot ${b.index} (${b.startSec}-${b.endSec}s): ${b.text}`)
    .join("\n");

  const scriptPrompt = arabic
    ? [
        input.sceneCore,
        "",
        "سيناريو لقطات فيرونيكس الزمني — التزم بهذا التوقيت داخل فيديو واحد متصل:",
        `المدة = ${totalSeconds}ث من أفعال النص فقط (${cycleCount} × ${CYCLE}ث) — بدون اختراع أفعال.`,
        "لكل فعل مكتوب: الفعل المحسّن ثم اسم الفاعل وحالته ثم اسم المفعول به وحالته.",
        timelineAr,
        "حافظ على الاستمرارية بين اللقطات. حركة سينمائية طبيعية. فيديو واحد متصل.",
      ].join("\n")
    : [
        input.sceneCore,
        "",
        "Veronix timed shot script — follow this exact pacing inside one continuous clip:",
        `No-repeat duration: ${totalSeconds}s (${cycleCount} actions × ${CYCLE}s).`,
        "Per action: verb → subject state (character name first) → object state (character name first). Never repeat a prior verb.",
        timelineEn,
        "Keep continuity between beats. Natural cinematic motion. One continuous video.",
      ].join("\n");

  return {
    beats,
    scriptPrompt,
    summaryAr: timelineAr,
    totalSeconds,
  };
}

/** Sync local builder (no LLM). */
export function buildVeronixShotScript(input: {
  originalPrompt: string;
  enhancedPrompt?: string;
  totalSeconds?: number;
  minSeconds?: number;
  maxSeconds?: number;
}): VeronixShotScript {
  const enhanced = (input.enhancedPrompt || "").trim();
  const source = enhanced || input.originalPrompt;
  const triples = planShotTriplesLocal(source);
  return packTriplesToScript(triples, {
    sceneCore: enhanced || cleanCore(input.originalPrompt),
    minSeconds: input.minSeconds,
    maxSeconds: input.maxSeconds,
  });
}

/** Async AI builder used on Generate confirm. */
export async function buildVeronixShotScriptAsync(input: {
  originalPrompt: string;
  enhancedPrompt?: string;
  minSeconds?: number;
  maxSeconds?: number;
}): Promise<VeronixShotScript> {
  const enhanced = (input.enhancedPrompt || "").trim();
  const source = enhanced || input.originalPrompt;
  const triples = await planShotTriplesAi(source);
  return packTriplesToScript(triples, {
    sceneCore: enhanced || cleanCore(input.originalPrompt),
    minSeconds: input.minSeconds,
    maxSeconds: input.maxSeconds,
  });
}

export function idealScriptSeconds(
  prompt: string,
  bounds?: { min?: number; max?: number },
): number {
  const min = Math.max(1, Math.floor(bounds?.min ?? 4));
  const max = Math.max(min, Math.floor(bounds?.max ?? 15));
  const actions = extractActionBeats(prompt);
  const cycles = Math.max(1, actions.length || 1);
  return Math.min(max, Math.max(min, cycles * CYCLE));
}

export function estimateShotCycles(totalSeconds: number): number {
  return Math.max(1, Math.ceil(Math.max(1, totalSeconds) / CYCLE));
}
