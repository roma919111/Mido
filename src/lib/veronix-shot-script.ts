/**
 * Veronix timed shot script — verb / object-state / result beats
 * packed into the chosen clip duration (single prompt, not multi-generate).
 *
 * Cycle: action 2s → object state 1s → result 1s
 * (Never repeat the same verb text for state/result beats.)
 */

import {
  countActionVerbs,
  splitActionClauses,
  splitByActionVerbs,
} from "@/lib/prompt-chain";

export type ShotRole = "action" | "object_state" | "result";

export type TimedBeat = {
  index: number;
  startSec: number;
  endSec: number;
  role: ShotRole;
  /** Arabic line for the recommendation UI */
  labelAr: string;
  /** Line used inside the generation script */
  text: string;
};

export type VeronixShotScript = {
  beats: TimedBeat[];
  /** Prompt sent when user accepts «توصية فيرونيكس» */
  scriptPrompt: string;
  /** Short Arabic summary shown in the confirm sheet */
  summaryAr: string;
  totalSeconds: number;
};

const ACTION_SECONDS = 2;
const STATE_SECONDS = 1;
const RESULT_SECONDS = 1;
const CYCLE = ACTION_SECONDS + STATE_SECONDS + RESULT_SECONDS; // 4

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
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

/** Pull ordered action phrases from the customer prompt. */
export function extractActionBeats(prompt: string): string[] {
  const core = cleanCore(prompt);
  if (!core) return [];
  const arabic = isArabic(core);
  let clauses = splitActionClauses(core, arabic)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);
  if (clauses.length < 2 && countActionVerbs(core, arabic) >= 1) {
    clauses = splitByActionVerbs(core, arabic)
      .map((c) => c.trim())
      .filter((c) => c.length >= 2);
  }
  if (!clauses.length) clauses = [core];

  const withVerbs = clauses.filter((c) => countActionVerbs(c, arabic) >= 1);
  const pool = withVerbs.length ? withVerbs : clauses;

  // Drop pure atmosphere / state / result lines — keep real verb beats.
  const actions = pool
    .map((c) => trimAtmospherePrefix(c))
    .filter((c) => {
      if (c.length < 4) return false;
      if (isAtmosphereOnly(c, arabic)) return false;
      if (looksLikeObjectState(c, arabic) && countActionVerbs(c, arabic) === 0) {
        return false;
      }
      // Object-state-heavy clause that only mentions exhaustion — not an action.
      if (
        looksLikeObjectState(c, arabic) &&
        countActionVerbs(c, arabic) === 0
      ) {
        return false;
      }
      return true;
    })
    // Prefer the concrete verb segment when a clause still starts with scene fluff.
    .map((c) => preferVerbSegment(c, arabic));

  return uniqKeepOrder(actions.length ? actions : pool.map(trimAtmospherePrefix)).slice(
    0,
    8,
  );
}

function trimAtmospherePrefix(text: string): string {
  return text
    .replace(
      /^في\s+مشهد\s+سينمائي[^،.]{0,120}،\s*/u,
      "",
    )
    .replace(
      /^In\s+a\s+cinematic[^,]{0,120},\s*/i,
      "",
    )
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

/** If the clause is long, keep from the first action verb onward. */
function preferVerbSegment(text: string, arabic: boolean): string {
  const t = text.trim();
  if (t.length < 40) return t;
  if (arabic) {
    const m = t.match(
      new RegExp(
        `((?:${"تسدد|ترفع|ترمي|تقذف|تمسك|تؤدي|تضرب|تقفل|تلف|تسقط|تمشي|تتمشى|تجلس|تضحك|تركض|تجري|تحمل|تقفز|تدفع|تسحب|تركل|يرفع|يرمي|يقذف|يمسك|يسقط|يمشي|يحمل|يقفز"})[^]*)$`,
      ),
    );
    if (m?.[1] && m[1].length >= 8 && m[1].length < t.length) {
      return m[1].trim();
    }
  }
  return t;
}

const OBJECT_STATE_AR =
  /المنهك|منهك|منهكة|التعب|مرهق|مرهقة|مرتخي|مرتخية|عاجز|عاجزة|لا\s*يقدر|لا\s*تقدر|عدم\s*القدرة|غير\s*قادر|لا\s*يسيطر|علامات\s*التعب|مرهق(?:ة)?|exhausted|tired|limp|helpless/i;

const RESULT_AR =
  /ابتسامة|واثقة|واثق|بثبات|ثبات\s*تام|ملامح|سقوط|نتيجة|لـ?تقوم|لـ?يؤدي|لـ?تؤدي|انشقاق|وقفة\s*يدين|مقص\s*الجسد|رد[ّ]?ة\s*فعل|يتزامن|في\s*نفس\s*اللحظة|smile|confident|handstand|result/i;

function looksLikeObjectState(text: string, arabic: boolean): boolean {
  if (arabic) return OBJECT_STATE_AR.test(text);
  return /\b(exhausted|tired|limp|helpless|worn\s*out|unable\s*to\s*move)\b/i.test(
    text,
  );
}

function looksLikeResult(text: string, arabic: boolean): boolean {
  if (arabic) return RESULT_AR.test(text);
  return /\b(smile|confident|result|handstand|lands?|falls?\s+onto|wraps?)\b/i.test(
    text,
  );
}

/**
 * Extract object-state phrases (patient condition) — e.g. ميدو المنهك…
 * Must NOT be a copy of the verb line.
 */
export function extractObjectStates(prompt: string): string[] {
  const core = cleanCore(prompt);
  if (!core) return [];
  const arabic = isArabic(core);
  const found: string[] = [];

  if (arabic) {
    // «ميدو المنهك الذي تبدو عليه علامات التعب…»
    for (const m of core.matchAll(
      /([\u0600-\u06FFa-zA-Z]{2,24})\s+(المنهك(?:ة)?|المنهكة|المرهِق(?:ة)?|المرهق(?:ة)?)(?:\s+الذي|\s+التي)?([^،.]{0,90})/gu,
    )) {
      const name = m[1]!.trim();
      const adj = m[2]!.trim();
      const rest = (m[3] || "").trim().replace(/^،\s*/, "");
      const line = rest
        ? `${name} ${adj}${rest.startsWith("الذي") || rest.startsWith("التي") ? " " : " — "}${rest}`
          .replace(/\s+/g, " ")
          .trim()
        : `${name} ${adj}`;
      found.push(line);
    }

    // Standalone fatigue / inability clauses
    for (const m of core.matchAll(
      /((?:علامات\s+)?التعب[^،.]{0,40}|عدم\s+القدرة\s+على\s+[^\s،.]{2,30}[^،.]{0,40}|غير\s+قادر(?:ة)?\s+على[^،.]{0,40}|منهك(?:ة)?(?:\s+تماماً)?)/gu,
    )) {
      found.push(m[1]!.trim());
    }

    // «جسده مرتخي / ممدداً على بطنه» style patient states
    for (const m of core.matchAll(
      /((?:جسده|جسمها|شعره|ملامحه|قدماه)\s+[^،.]{4,60})/gu,
    )) {
      if (OBJECT_STATE_AR.test(m[1]!) || /ممدد|مرتخي|يتطاير|متفاجئ/.test(m[1]!)) {
        found.push(m[1]!.trim());
      }
    }
  } else {
    for (const m of core.matchAll(
      /([A-Za-z][A-Za-z-]{1,20})\s*,?\s*(exhausted|tired|limp|helpless)([^.]{0,80})/gi,
    )) {
      found.push(`${m[1]} ${m[2]}${m[3] || ""}`.replace(/\s+/g, " ").trim());
    }
  }

  // Clause scan fallback — only short state-focused clauses
  const clauses = splitActionClauses(core, arabic);
  for (const c of clauses) {
    if (!looksLikeObjectState(c, arabic)) continue;
    if (countActionVerbs(c, arabic) >= 1 && c.length > 70) continue;
    found.push(c.trim());
  }

  return uniqKeepOrder(found)
    .filter((line) => line.length >= 8 && line.length <= 140)
    .slice(0, 8);
}

/**
 * Extract result / reaction beats — actor emotion or consequence of the action.
 * Distinct from the verb line and from object exhaustion.
 */
export function extractResultBeats(prompt: string): string[] {
  const core = cleanCore(prompt);
  if (!core) return [];
  const arabic = isArabic(core);
  const found: string[] = [];

  if (arabic) {
    for (const m of core.matchAll(
      /((?:ابتسامة\s+واثقة[^،.]{0,40}|تزين\s+ابتسامة[^،.]{0,50}|بثبات\s+تام[^،.]{0,50}|محافظة\s+بثبات[^،.]{0,60}|وقفة\s+يدين[^،.]{0,70}|انشقاق\s+أفقي[^،.]{0,50}|مقص\s+الجسد[^،.]{0,50}|سقوط\s+[\u0600-\u06FF]+[^،.]{0,70}))/gu,
    )) {
      found.push(m[1]!.trim());
    }
  } else {
    for (const m of core.matchAll(
      /((?:confident\s+smile[^.]{0,40}|handstand[^.]{0,60}|lands?\s+on[^.]{0,50}|body\s+scissors[^.]{0,40}))/gi,
    )) {
      found.push(m[1]!.trim());
    }
  }

  const clauses = splitActionClauses(core, arabic);
  for (const c of clauses) {
    if (!looksLikeResult(c, arabic) || looksLikeObjectState(c, arabic)) continue;
    // Skip long multi-action paragraphs — keep compact reaction lines.
    if (c.length > 110 || countActionVerbs(c, arabic) >= 2) continue;
    found.push(c.trim());
  }

  return uniqKeepOrder(found)
    .filter((line) => line.length <= 120)
    .slice(0, 8);
}

function shortenAction(action: string): string {
  return trimAtmospherePrefix(action)
    // Keep the verb beat only — state/result belong in later shots.
    .replace(/\s+بينما\s+.*/u, "")
    .replace(/\s+و\s*بينما\s+.*/u, "")
    .replace(/\s+تحرك(?:ت|ين)?\s+الكاميرا.*/u, "")
    .replace(/\s+الذي\s+تبدو\s+عليه.*/u, "")
    .replace(/\s+التي\s+تبدو\s+عليها.*/u, "")
    .replace(/\s+لـ?تؤدي\s+.*/u, "")
    .replace(/\s+لـ?يقوم\s+.*/u, "")
    .replace(/\s+يتزامن\s+.*/u, "")
    .replace(/\s+وهي\s+لا\s+تزال.*/u, "")
    .replace(/\s+المنهك(?:ة)?/gu, "")
    .replace(/\s+المرهق(?:ة)?/gu, "")
    .replace(/\s+/g, " ")
    .replace(/[،,\s]+$/u, "")
    .trim()
    .slice(0, 100);
}

function pickDistinct(
  pool: string[],
  index: number,
  forbidden: string,
  fallback: string,
): string {
  if (!pool.length) return fallback;
  for (let i = 0; i < pool.length; i += 1) {
    const cand = pool[(index + i) % pool.length]!;
    if (!cand) continue;
    // Reject near-duplicates of the action verb line.
    if (cand === forbidden) continue;
    if (forbidden && cand.includes(forbidden) && cand.length < forbidden.length + 8) {
      continue;
    }
    if (
      forbidden &&
      forbidden.includes(cand) &&
      Math.abs(forbidden.length - cand.length) < 8
    ) {
      continue;
    }
    return cand;
  }
  return fallback;
}

function roleLabelAr(role: ShotRole, text: string): string {
  if (role === "action") return text;
  if (role === "object_state") return `حالة المفعول به: ${text}`;
  return `النتيجة / ردّة الفعل: ${text}`;
}

function roleText(role: ShotRole, text: string, arabic: boolean): string {
  if (role === "action") return text;
  if (arabic) {
    if (role === "object_state") {
      return `ركز على حالة المفعول به: ${text}`;
    }
    return `النتيجة وردّة الفعل: ${text}`;
  }
  if (role === "object_state") {
    return `Close beat on the object's state: ${text}`;
  }
  return `Result / reaction beat: ${text}`;
}

/**
 * Pack timed beats into `totalSeconds`:
 * each cycle = action 2s → object state 1s → result 1s, then repeat.
 */
export function buildVeronixShotScript(input: {
  originalPrompt: string;
  /** Optional AI-enhanced prompt (preferred for extraction + script body). */
  enhancedPrompt?: string;
  totalSeconds: number;
}): VeronixShotScript {
  const totalSeconds = Math.max(
    1,
    Math.min(60, Math.round(Number(input.totalSeconds) || 4)),
  );
  const enhanced = (input.enhancedPrompt || "").trim();
  const source = enhanced || input.originalPrompt;
  const actions = extractActionBeats(source);
  const objectStates = extractObjectStates(source);
  const results = extractResultBeats(source);
  const arabic =
    isArabic(enhanced) ||
    isArabic(input.originalPrompt) ||
    actions.some((a) => isArabic(a));

  const beats: TimedBeat[] = [];
  let t = 0;
  let cycleIdx = 0;

  while (t < totalSeconds) {
    const actionRaw =
      actions[cycleIdx % Math.max(1, actions.length)] ||
      cleanCore(input.originalPrompt);
    const action = shortenAction(actionRaw);
    cycleIdx += 1;
    const remaining = totalSeconds - t;

    const objectFallback = arabic
      ? "المفعول به منهك وتبدو عليه علامات التعب وعدم القدرة على الحراك"
      : "the other character is exhausted and barely able to move";
    const resultFallback = arabic
      ? "تعابير الفاعل وردّة فعله مع استمرار الحركة"
      : "the actor's expression and reaction as the motion continues";

    const objectLine = pickDistinct(
      objectStates,
      cycleIdx - 1,
      action,
      objectFallback,
    );
    const resultLine = pickDistinct(
      results,
      cycleIdx - 1,
      action,
      resultFallback,
    );

    const slots: Array<{ role: ShotRole; want: number; line: string }> = [
      { role: "action", want: Math.min(ACTION_SECONDS, remaining), line: action },
      {
        role: "object_state",
        want: Math.min(STATE_SECONDS, Math.max(0, remaining - ACTION_SECONDS)),
        line: objectLine,
      },
      {
        role: "result",
        want: Math.min(
          RESULT_SECONDS,
          Math.max(0, remaining - ACTION_SECONDS - STATE_SECONDS),
        ),
        line: resultLine,
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
        labelAr: roleLabelAr(slot.role, slot.line),
        text: roleText(slot.role, slot.line, arabic),
      });
      t = endSec;
    }

    if (t < totalSeconds && slots.every((s) => s.want < 1)) {
      beats.push({
        index: beats.length + 1,
        startSec: t,
        endSec: t + 1,
        role: "action",
        labelAr: roleLabelAr("action", action),
        text: roleText("action", action, arabic),
      });
      t += 1;
    }
  }

  const timelineAr = beats
    .map(
      (b) =>
        `لقطة ${b.index}: ${b.startSec}–${b.endSec}ث — ${b.labelAr}`,
    )
    .join("\n");

  const timelineEn = beats
    .map(
      (b) =>
        `Shot ${b.index} (${b.startSec}-${b.endSec}s): ${b.text}`,
    )
    .join("\n");

  const sceneCore = enhanced || cleanCore(input.originalPrompt);

  const scriptPrompt = arabic
    ? [
        sceneCore,
        "",
        "سيناريو لقطات فيرونيكس الزمني — التزم بهذا التوقيت داخل فيديو واحد متصل:",
        "كل دورة = فعل (2ث) ثم حالة المفعول به (1ث) ثم النتيجة/ردّة الفعل (1ث). لا تكرر نص الفعل في لقطات الحالة والنتيجة.",
        timelineAr,
        "حافظ على الاستمرارية بين اللقطات. حركة سينمائية طبيعية. فيديو واحد متصل.",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        sceneCore,
        "",
        "Veronix timed shot script — follow this exact pacing inside one continuous clip:",
        "Each cycle = action (2s) → object state (1s) → result/reaction (1s). Do not repeat the verb line in state/result beats.",
        timelineEn,
        "Keep continuity between beats. Natural cinematic motion. One continuous video.",
      ]
        .filter(Boolean)
        .join("\n");

  return {
    beats,
    scriptPrompt,
    summaryAr: timelineAr,
    totalSeconds,
  };
}

/** Approximate cycle count helper (for UI copy). */
export function estimateShotCycles(totalSeconds: number): number {
  return Math.max(1, Math.ceil(Math.max(1, totalSeconds) / CYCLE));
}
