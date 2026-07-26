/**
 * State continuity / prompt chaining for sequential action prompts.
 * Builds each new action from the previous final pose instead of resetting.
 *
 * Entity injection replaces generic person nouns (الأنثى / الرجل / a man…)
 * with concrete appearance phrases from vision — never mid-word mangling.
 */

export type SceneState = {
  arabic: boolean;
  /** Concrete entity phrases used in the last prompt */
  entities: string[];
  /** Optional genders aligned with entities: female | male | unknown */
  entityGenders?: Array<"female" | "male" | "unknown">;
  /** Final physical arrangement after the last action */
  finalPose: string;
  /** Last user action (core idea) */
  lastAction: string;
  /** Optional setting carried forward */
  setting?: string;
  updatedAt: string;
};

const SEQUENCE_AR =
  /^(ثم|وبعدين|بعدين|بعد ذلك|بعدها|بعدما|بعد\s+أن|وبعد\s+ذلك|و\s*بعدها|وبعدها)\s+/i;
const SEQUENCE_EN =
  /^(then|and then|after that|afterwards|afterward|next|and next|subsequently)\s+/i;

export function isSequentialAction(prompt: string): boolean {
  const t = prompt.trim();
  return SEQUENCE_AR.test(t) || SEQUENCE_EN.test(t);
}

export function stripSequencePrefix(prompt: string): string {
  return prompt
    .trim()
    .replace(SEQUENCE_AR, "")
    .replace(SEQUENCE_EN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Infer a compact final-pose summary from an action phrase. */
export function inferFinalPose(action: string, arabic: boolean): string {
  const a = action.trim();
  if (!a) {
    return arabic ? "الشخصيات في وضعية مستقرة" : "characters in a stable pose";
  }

  if (arabic) {
    if (/يرفع|رفع|حاملاً|يحمل/.test(a) && /فوق|رأس|عالي/.test(a)) {
      return "أحد الشخصيات يحمل الآخر مرفوعاً في الهواء";
    }
    if (/يلكم|لكمة|يضرب|يلكّم/.test(a)) {
      return "الشخصيات في وضعية اشتباك بعد اللكمة مباشرة";
    }
    if (/يضع|إنزال|ينزل|على الأرض|أرضا|يسقط|ترمي|يرمي/.test(a)) {
      return "الشخصيات بعد حركة الرمي/الإنزال على وضعية جديدة";
    }
    if (/يرقص|رقص|وقفة|انشقاق/.test(a)) {
      return "الأنثى/الشخصية في وضعية وقفة أو انشقاق بعد الحركة";
    }
    if (/يركض|يجري|يمشي|يتمش/.test(a)) {
      return "الشخصيات في منتصف الحركة على المسار نفسه";
    }
    return `نهاية الحركة السابقة: ${a}`;
  }

  if (/\b(lift|lifts|lifting|holds?|holding|raise[sd]?|throw[s]?)\b/i.test(a)) {
    return "one character is holding or has just thrown the other";
  }
  if (/\b(punch|punches|punching|hit|hits|hitting|strike[sd]?)\b/i.test(a)) {
    return "characters are mid-clash immediately after the punch";
  }
  if (/\b(put|puts|place[sd]?|lower(?:s|ed|ing)?|drop(?:s|ped)?|on the (?:ground|floor))\b/i.test(a)) {
    return "characters after the lower/drop onto a new pose";
  }
  if (/\b(run|running|walk|walking)\b/i.test(a)) {
    return "characters are mid-motion along the same path";
  }
  return `end state of previous action: ${a}`;
}

export function buildChainedIdea(input: {
  action: string;
  previous: SceneState | null | undefined;
  entityPhrases?: string[];
  entityGenders?: Array<"female" | "male" | "unknown">;
  forceChain?: boolean;
}): { idea: string; chained: boolean } {
  const arabic = isArabic(input.action) || Boolean(input.previous?.arabic);
  const sequential = Boolean(input.forceChain) || isSequentialAction(input.action);
  const rawAction = stripSequencePrefix(input.action);
  const entities =
    input.entityPhrases?.filter(Boolean).slice(0, 4) ||
    input.previous?.entities ||
    [];
  const genders =
    input.entityGenders ||
    input.previous?.entityGenders ||
    entities.map(() => "unknown" as const);

  if (!sequential || !input.previous?.finalPose) {
    if (entities.length >= 1) {
      return {
        chained: false,
        idea: injectEntitiesIntoAction(rawAction, entities, arabic, genders),
      };
    }
    return { chained: false, idea: rawAction };
  }

  const prevPose = input.previous.finalPose;
  if (arabic) {
    return {
      chained: true,
      idea: [
        `بدءاً من الحالة النهائية السابقة (${prevPose})`,
        `ينتقل المشهد بسلاسة إلى: ${injectEntitiesIntoAction(rawAction, entities, true, genders)}`,
        "بدون إعادة تهيئة المشهد من الصفر، مع الحفاظ على هوية الشخصيات والموقع",
      ].join(" "),
    };
  }

  return {
    chained: true,
    idea: [
      `Starting from the previous final state (${prevPose})`,
      `the scene transitions smoothly into: ${injectEntitiesIntoAction(rawAction, entities, false, genders)}`,
      "without resetting the scene, preserving character identity and location",
    ].join(" "),
  };
}

type Gender = "female" | "male" | "unknown";

type GenericHit = {
  start: number;
  end: number;
  gender: Gender;
  /** second person / "another" */
  secondary: boolean;
};

function collectArabicGenerics(text: string): GenericHit[] {
  const patterns: Array<{ re: RegExp; gender: Gender; secondary: boolean }> = [
    { re: /رجلاً\s+آخر|رجل\s+آخر|شخصاً\s+آخر|شخص\s+آخر|الرجل\s+الآخر/g, gender: "male", secondary: true },
    { re: /امرأة\s+أخرى|فتاة\s+أخرى|الأنثى\s+الأخرى|الانثى\s+الأخرى/g, gender: "female", secondary: true },
    { re: /الأنثى|الانثى|أنثى|انثى|المرأة|امرأ[ةه]|فتاة/g, gender: "female", secondary: false },
    { re: /الرجل|رجلاً|رجل|شاب|ذكر/g, gender: "male", secondary: false },
    { re: /الشخص|شخصاً|شخص/g, gender: "unknown", secondary: false },
  ];

  const hits: GenericHit[] = [];
  const occupied: Array<[number, number]> = [];

  for (const { re, gender, secondary } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (occupied.some(([a, b]) => start < b && end > a)) continue;
      occupied.push([start, end]);
      hits.push({ start, end, gender, secondary });
    }
  }

  hits.sort((a, b) => a.start - b.start);
  return hits;
}

function collectEnglishGenerics(text: string): GenericHit[] {
  const patterns: Array<{ re: RegExp; gender: Gender; secondary: boolean }> = [
    { re: /\banother man\b/gi, gender: "male", secondary: true },
    { re: /\banother woman\b/gi, gender: "female", secondary: true },
    { re: /\banother person\b/gi, gender: "unknown", secondary: true },
    { re: /\b(?:the |a )?woman\b/gi, gender: "female", secondary: false },
    { re: /\b(?:the |a )?man\b/gi, gender: "male", secondary: false },
    { re: /\b(?:the |a )?girl\b/gi, gender: "female", secondary: false },
    { re: /\b(?:the |a )?boy\b/gi, gender: "male", secondary: false },
    { re: /\b(?:the |a )?person\b/gi, gender: "unknown", secondary: false },
  ];
  const hits: GenericHit[] = [];
  const occupied: Array<[number, number]> = [];
  for (const { re, gender, secondary } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (occupied.some(([a, b]) => start < b && end > a)) continue;
      occupied.push([start, end]);
      hits.push({ start, end, gender, secondary });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

function pickEntityIndex(
  hit: GenericHit,
  genders: Gender[],
  used: Set<number>,
): number {
  // Prefer unused entity matching gender
  for (let i = 0; i < genders.length; i += 1) {
    if (used.has(i)) continue;
    if (hit.gender !== "unknown" && genders[i] === hit.gender) return i;
  }
  // Secondary hit prefers index 1 if free
  if (hit.secondary && genders.length > 1 && !used.has(1)) return 1;
  for (let i = 0; i < genders.length; i += 1) {
    if (!used.has(i)) return i;
  }
  return Math.min(hit.secondary ? 1 : 0, Math.max(0, genders.length - 1));
}

/**
 * Replace generic person nouns with concrete entity phrases.
 * Uses span replacement (not naive string replace) to avoid corrupting Arabic.
 */
export function injectEntitiesIntoAction(
  action: string,
  entities: string[],
  arabic: boolean,
  genders?: Gender[],
): string {
  if (!action.trim() || !entities.length) return action;

  const text = action.trim();
  const gens: Gender[] =
    genders && genders.length === entities.length
      ? genders
      : entities.map((e) => inferGenderFromPhrase(e));

  const hits = arabic ? collectArabicGenerics(text) : collectEnglishGenerics(text);
  if (!hits.length) {
    // No generic nouns — prepend primary entity only if action is very short
    return text;
  }

  const used = new Set<number>();
  const replacements: Array<{ start: number; end: number; value: string }> = [];

  for (const hit of hits) {
    const idx = pickEntityIndex(hit, gens, used);
    used.add(idx);
    const value = entities[idx] || entities[0]!;
    replacements.push({ start: hit.start, end: hit.end, value });
  }

  // Apply from end to start so indices stay valid
  let out = text;
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.value + out.slice(r.end);
  }
  return out.replace(/\s+/g, " ").trim();
}

export function inferGenderFromPhrase(phrase: string): Gender {
  const p = phrase.trim();
  if (/أنثى|انثى|امرأة|فتاة|woman|girl|female/i.test(p)) return "female";
  if (/رجل|شاب|ذكر|\bman\b|\bboy\b|male/i.test(p)) return "male";
  return "unknown";
}

export function buildSceneState(input: {
  action: string;
  enhanced: string;
  entityPhrases: string[];
  entityGenders?: Gender[];
  setting?: string;
  previous?: SceneState | null;
}): SceneState {
  const arabic = isArabic(input.action) || isArabic(input.enhanced);
  const actionCore = stripSequencePrefix(input.action);
  const entities = input.entityPhrases.length
    ? input.entityPhrases
    : input.previous?.entities || [];
  return {
    arabic,
    entities,
    entityGenders:
      input.entityGenders ||
      input.previous?.entityGenders ||
      entities.map((e) => inferGenderFromPhrase(e)),
    finalPose: inferFinalPose(actionCore, arabic),
    lastAction: actionCore,
    setting: input.setting || input.previous?.setting,
    updatedAt: new Date().toISOString(),
  };
}
