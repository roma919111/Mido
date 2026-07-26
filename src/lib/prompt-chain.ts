/**
 * State continuity / prompt chaining for sequential action prompts.
 * Builds each new action from the previous final pose instead of resetting.
 */

export type SceneState = {
  arabic: boolean;
  /** Concrete entity phrases used in the last prompt */
  entities: string[];
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
    if (/يرفع|رفع|حاملاً|يحمل/.test(a) && /فوق|رأس/.test(a)) {
      return "أحد الشخصيات ما زال يحمل الآخر مرفوعاً فوق رأسه";
    }
    if (/يلكم|لكمة|يضرب|يلكّم/.test(a)) {
      return "الشخصيات في وضعية اشتباك بعد اللكمة مباشرة";
    }
    if (/يضع|إنزال|ينزل|على الأرض|أرضا/.test(a)) {
      return "أحد الشخصيات أصبح على الأرض بعد الإنزال";
    }
    if (/يركض|يجري|يمشي|يتمش/.test(a)) {
      return "الشخصيات في منتصف الحركة على المسار نفسه";
    }
    if (/يرقص|رقص/.test(a)) {
      return "الشخصيات في وضعية رقص مستمرة";
    }
    return `نهاية الحركة السابقة: ${a}`;
  }

  if (/\b(lift|lifts|lifting|holds?|holding|raise[sd]?)\b/i.test(a) && /\b(over|above|head)\b/i.test(a)) {
    return "one character is still holding the other raised above their head";
  }
  if (/\b(punch|punches|punching|hit|hits|hitting|strike[sd]?)\b/i.test(a)) {
    return "characters are mid-clash immediately after the punch";
  }
  if (/\b(put|puts|place[sd]?|lower(?:s|ed|ing)?|set(?:s|ting)? down|on the (?:ground|floor))\b/i.test(a)) {
    return "one character is on the ground after being lowered";
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
  /** Chain only when user marks continuation (ثم/then) unless forceChain */
  forceChain?: boolean;
}): { idea: string; chained: boolean } {
  const arabic = isArabic(input.action) || Boolean(input.previous?.arabic);
  const sequential =
    Boolean(input.forceChain) || isSequentialAction(input.action);
  const rawAction = stripSequencePrefix(input.action);
  const entities =
    input.entityPhrases?.filter(Boolean).slice(0, 4) ||
    input.previous?.entities ||
    [];

  if (!sequential || !input.previous?.finalPose) {
    if (entities.length >= 1) {
      return {
        chained: false,
        idea: injectEntitiesIntoAction(rawAction, entities, arabic),
      };
    }
    return { chained: false, idea: rawAction };
  }

  const prevPose = input.previous.finalPose;
  const entityLine = entities.length
    ? arabic
      ? `الشخصيات نفسها: ${entities.join(" و ")}.`
      : `Same characters: ${entities.join(" and ")}.`
    : "";

  if (arabic) {
    return {
      chained: true,
      idea: [
        `بدءاً من الحالة النهائية السابقة (${prevPose})`,
        entityLine,
        `ينتقل المشهد بسلاسة إلى: ${injectEntitiesIntoAction(rawAction, entities, true)}`,
        "بدون إعادة تهيئة المشهد من الصفر، مع الحفاظ على هوية الشخصيات والموقع",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    chained: true,
    idea: [
      `Starting from the previous final state (${prevPose})`,
      entityLine,
      `the scene transitions smoothly into: ${injectEntitiesIntoAction(rawAction, entities, false)}`,
      "without resetting the scene, preserving character identity and location",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Replace generic person nouns with concrete entity phrases when possible.
 * Examples AR: رجل ... رجلاً آخر → entity0 ... entity1
 */
export function injectEntitiesIntoAction(
  action: string,
  entities: string[],
  arabic: boolean,
): string {
  if (!action.trim()) return action;
  if (!entities.length) return action;

  let out = action.trim();

  if (arabic) {
    const e0 = entities[0];
    const e1 = entities[1];
    // Order matters: longer multi-word patterns first.
    out = out
      .replace(/رجلاً\s+آخر|رجل\s+آخر|شخصاً\s+آخر|شخص\s+آخر/g, e1 || e0 || "الشخصية الثانية")
      .replace(/امرأة\s+أخرى|فتاة\s+أخرى/g, e1 || e0 || "الشخصية الثانية");

    // First remaining generic subject
    if (e0) {
      out = out
        .replace(/(^|[\s،,])رجل(?=[\s،,]|$)/, `$1${e0}`)
        .replace(/(^|[\s،,])امرأة(?=[\s،,]|$)/, `$1${e0}`)
        .replace(/(^|[\s،,])شخص(?=[\s،,]|$)/, `$1${e0}`)
        .replace(/(^|[\s،,])شاب(?=[\s،,]|$)/, `$1${e0}`)
        .replace(/(^|[\s،,])فتاة(?=[\s،,]|$)/, `$1${e0}`);
    }
    // If still has a second generic and we have e1
    if (e1 && /رجل|امرأة|شخص/.test(out) && !out.includes(e1)) {
      out = out
        .replace(/رجل/, e1)
        .replace(/امرأة/, e1)
        .replace(/شخص/, e1);
    }
    return out;
  }

  const e0 = entities[0];
  const e1 = entities[1];
  out = out
    .replace(/\banother man\b/gi, e1 || e0 || "the second man")
    .replace(/\banother woman\b/gi, e1 || e0 || "the second woman")
    .replace(/\banother person\b/gi, e1 || e0 || "the second person");

  if (e0) {
    out = out
      .replace(/\ba man\b/i, e0)
      .replace(/\bthe man\b/i, e0)
      .replace(/\ba woman\b/i, e0)
      .replace(/\bthe woman\b/i, e0)
      .replace(/\ba person\b/i, e0);
  }
  if (e1) {
    // second occurrence of man/woman
    out = out
      .replace(/\ba man\b/i, e1)
      .replace(/\bthe man\b/i, e1)
      .replace(/\ba woman\b/i, e1)
      .replace(/\bthe woman\b/i, e1);
  }
  return out;
}

export function buildSceneState(input: {
  action: string;
  enhanced: string;
  entityPhrases: string[];
  setting?: string;
  previous?: SceneState | null;
}): SceneState {
  const arabic = isArabic(input.action) || isArabic(input.enhanced);
  const actionCore = stripSequencePrefix(input.action);
  return {
    arabic,
    entities: input.entityPhrases.length
      ? input.entityPhrases
      : input.previous?.entities || [],
    finalPose: inferFinalPose(actionCore, arabic),
    lastAction: actionCore,
    setting: input.setting || input.previous?.setting,
    updatedAt: new Date().toISOString(),
  };
}
