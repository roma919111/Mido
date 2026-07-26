/**
 * General multi-shot planner for ANY sequential action prompt.
 *
 * Not tied to fights / handstands / body-locks — any `ثم` / `then` beat
 * becomes its own short clip. Later clips keep living continuity for
 * characters who are not the primary actor of that beat.
 */

import {
  detectClauseActor,
  inferCharacterPoses,
  livingHeldAside,
  splitActionClauses,
  type SceneState,
} from "@/lib/prompt-chain";

export type PlannedShot = {
  index: number;
  /** Raw action clause for this beat */
  action: string;
  /** Focused generation prompt (one primary action + living holds) */
  prompt: string;
};

export type ShotPlan = {
  multiShot: boolean;
  shotCount: number;
  perShotSeconds: number;
  shots: PlannedShot[];
  /** Why multi-shot was skipped / enabled */
  reason: string;
};

const MAX_SHOTS = 6;
const DEFAULT_PER_SHOT_SECONDS = 5;

/** Strip cinematic wrapper / trailing polish so splitting sees the action chain. */
export function extractActionBody(prompt: string): {
  body: string;
  prefix: string;
  suffix: string;
  arabic: boolean;
} {
  const raw = prompt.trim();
  const arabic = /[\u0600-\u06FF]/.test(raw);

  // Peel common enhance wrappers
  let body = raw
    .replace(/^مشهد سينمائي واقعي:\s*/i, "")
    .replace(/^صورة سينمائية واقعية:\s*/i, "")
    .replace(/^Cinematic realistic (?:scene|image):\s*/i, "");

  // Trailing polish / setting lines after the action chain
  const suffixMatch = body.match(
    /\.\s*(?:المكان كما في الصورة|حافظ على نفس|Setting matches|Keep the exact|تفاصيل وجه|دفعة كاميرا|إضاءة|مشهد سينمائي واقعي،|وفي اللحظة الأخيرة|In the final held moment)[\s\S]*$/i,
  );
  let suffix = "";
  if (suffixMatch) {
    suffix = suffixMatch[0].replace(/^\.\s*/, "").trim();
    body = body.slice(0, suffixMatch.index).trim();
  }

  // Drop vivid final tableau from body — we rebuild per shot
  body = body.replace(/\.\s*وفي اللحظة الأخيرة:[\s\S]*$/i, "").trim();
  body = body.replace(/\.\s*In the final held moment:[\s\S]*$/i, "").trim();

  return { body, prefix: arabic ? "مشهد سينمائي واقعي" : "Cinematic realistic scene", suffix, arabic };
}

export function planShotSequence(
  prompt: string,
  options: {
    maxShots?: number;
    perShotSeconds?: number;
    /** Free trial / user opt-out */
    forceSingle?: boolean;
    previousState?: SceneState | null;
  } = {},
): ShotPlan {
  const maxShots = options.maxShots ?? MAX_SHOTS;
  const perShotSeconds = options.perShotSeconds ?? DEFAULT_PER_SHOT_SECONDS;
  const { body, prefix, suffix, arabic } = extractActionBody(prompt);

  if (options.forceSingle) {
    return {
      multiShot: false,
      shotCount: 1,
      perShotSeconds,
      shots: [{ index: 0, action: body, prompt: prompt.trim() }],
      reason: "single_forced",
    };
  }

  const clauses = splitActionClauses(body, arabic).filter((c) => c.length >= 3);
  if (clauses.length < 2) {
    return {
      multiShot: false,
      shotCount: 1,
      perShotSeconds,
      shots: [{ index: 0, action: body || prompt.trim(), prompt: prompt.trim() }],
      reason: "single_action",
    };
  }

  // Cap and merge overflow into the last shot (general — any actions)
  const heads = clauses.slice(0, maxShots - 1);
  const tail = clauses.slice(maxShots - 1);
  const normalized =
    tail.length > 1
      ? [...heads, tail.join(arabic ? " ثم " : " then ")]
      : [...heads, ...tail];

  let lockedFemale: string | undefined = options.previousState?.characterPoses?.female;
  let lockedMale: string | undefined = options.previousState?.characterPoses?.male;

  const shots: PlannedShot[] = normalized.map((clause, index) => {
    const actor = detectClauseActor(clause, arabic);
    const poses = inferCharacterPoses(clause, arabic);
    const prevFemale = lockedFemale;
    const prevMale = lockedMale;

    // Update locks from this beat (same general continuity rule)
    if (poses.female || actor === "female") {
      lockedFemale = poses.female || lockedFemale || (arabic ? `بعد: ${clause}` : `after: ${clause}`);
    }
    if (poses.male || actor === "male") {
      lockedMale = poses.male || lockedMale || (arabic ? `بعد: ${clause}` : `after: ${clause}`);
    }
    // Also update from keyword holds
    if (/وقفة\s*يدين|handstand|انشقاق/.test(clause)) {
      lockedFemale = arabic
        ? "وقفة يدين على الأرض مع انشقاق أفقي كامل للساقين"
        : "handstand with a full horizontal split";
    }
    if (/ممدد على بطن|منتصف\s*ساق/.test(clause)) {
      lockedMale = arabic
        ? "ممدد على بطنه فوق منتصف ساقي الأنثى"
        : "lying belly-down across the middle of her legs";
    }

    const holds: string[] = [];
    if (index > 0) {
      // Anyone not clearly the sole focus keeps a living description
      const femaleMoving =
        actor === "female" ||
        /ترفع|ترمي|تقذف|تمسك|تؤدي|تسدد|تضرب|تقفل|تلف|تسقط/.test(clause);
      const maleMoving =
        actor === "male" ||
        /يرفع|يرمي|يمسك|يسقط|ممدد|تقذفه|ترفعه|ترميه|تمسكه/.test(clause);

      if (!femaleMoving && prevFemale) {
        holds.push(livingHeldAside(arabic ? "الأنثى" : "the woman", prevFemale, "female", arabic, index));
      }
      if (!maleMoving && prevMale) {
        holds.push(livingHeldAside(arabic ? "الرجل" : "the man", prevMale, "male", arabic, index + 7));
      }
      // If both move (lift/throw), still paint the airborne/held partner vividly when prior exists
      if (femaleMoving && maleMoving && prevMale && /ترمي|تقذف|ترفع/.test(clause)) {
        // partner state updates mid-clause; living hold after action is enough via poses
      }
    }

    const actionLine = [clause, ...holds].filter(Boolean).join(arabic ? "، " : ", ");
    const parts = [
      `${prefix}: ${actionLine}`,
      arabic
        ? "لقطة واحدة متصلة، حركة واضحة واحدة فقط في هذه اللقطة، بدون إعادة تهيئة المشهد"
        : "one continuous shot, a single clear action beat, no scene reset",
      suffix
        ? suffix
            .split(/(?<=\.)\s+/)
            .filter((line) => /المكان كما في الصورة|Setting matches|حافظ على نفس|Keep the exact/.test(line))
            .slice(0, 2)
            .join(" ")
        : "",
      arabic
        ? "إضاءة طبيعية سينمائية، تفاصيل حادة، بدون تشويش"
        : "natural cinematic light, sharp detail, no flicker",
    ].filter(Boolean);

    return {
      index,
      action: clause,
      prompt: parts.join(". ").replace(/\s+/g, " ").trim(),
    };
  });

  return {
    multiShot: true,
    shotCount: shots.length,
    perShotSeconds,
    shots,
    reason: "sequential_beats",
  };
}

export function shouldAutoMultiShot(plan: ShotPlan, opts: { freeTrial?: boolean; media?: string }): boolean {
  if (opts.media && opts.media !== "video") return false;
  if (opts.freeTrial) return false;
  return plan.multiShot && plan.shotCount >= 2;
}
