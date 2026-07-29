/**
 * State continuity / prompt chaining for sequential action prompts.
 *
 * GENERAL RULE (not tied to any specific move like handstand/body-lock):
 * After each beat, every character ends in a state. The next beat builds on
 * those states. Anyone not explicitly moved keeps living in that state —
 * described vividly (hair, expression, tension, atmosphere), NEVER with meta
 * phrases like "يحافظ على حالته السابقة".
 *
 * Entity injection replaces generic person nouns with concrete vision phrases.
 */

export type SceneState = {
  arabic: boolean;
  /** Concrete entity phrases used in the last prompt */
  entities: string[];
  /** Optional genders aligned with entities: female | male | unknown */
  entityGenders?: Array<"female" | "male" | "unknown">;
  /** Final physical arrangement after the last action */
  finalPose: string;
  /** Per-character pose locks carried into the next shot/clause */
  characterPoses?: Partial<Record<Gender, string>>;
  /** Last user action (core idea) */
  lastAction: string;
  /** Optional setting carried forward */
  setting?: string;
  updatedAt: string;
};

const SEQUENCE_AR =
  /^(ثم|وبعدين|بعدين|بعد ذلك|بعدها|بعدما|بعد\s+أن|قبل\s+أن|قبل\s+ان|وبعد\s+ذلك|و\s*بعدها|وبعدها)\s+/i;
const SEQUENCE_EN =
  /^(then|and then|after that|afterwards|afterward|next|and next|subsequently|before|after)\s+/i;

/**
 * Temporal / causal beat boundaries — NOT only ثم.
 * Lookahead keeps the marker with the NEXT clause (قبل ان يسقط تمسكه…).
 */
const CLAUSE_SPLIT_AR =
  /\s+(?=(?:ثم|وبعدين|بعدين|بعد ذلك|بعدها|وبعدها|و\s*بعدها|بعدما|بعد\s*أن|قبل\s*أن|قبل\s*ان)\s+)/i;
const CLAUSE_SPLIT_EN =
  /\s+(?=(?:and then|then|after that|afterwards|afterward|next|subsequently|before|after which)\s+)/i;

export function isSequentialAction(prompt: string): boolean {
  const t = prompt.trim();
  if (SEQUENCE_AR.test(t) || SEQUENCE_EN.test(t)) return true;
  // Context: multiple action verbs even without an explicit "ثم"
  return countActionVerbs(t, isArabic(t)) >= 2;
}

/**
 * Arabic imperfect / common action stems used to detect beats.
 * Includes approach / lie-down / choke / wrap — not only fight verbs.
 */
export const ARABIC_ACTION_VERBS =
  "تسدد|ترفع|ترمي|تقذف|تمسك|تؤدي|تضرب|تقفل|تلف|تسقط|تمشي|تتمشى|تجلس|تضحك|تركض|تجري|تعطي|تأخذ|تفتح|تغلق|تقول|تنظر|ترقص|تضع|تحمل|تقفز|تدفع|تسحب|تركل|تعانق|تقبّل|تقبل|تتقدم|تتمدد|تستلقي|تنحني|تضغط|تلتف|تقترب|تختنق|تخنق|تقف|تركع|تنام|تمد|تعض|تستيقظ|تطبخ|تاكل|تأكل|تدخل|تذهب|يرفع|يرمي|يقذف|يمسك|يسقط|يمشي|يجلس|يضحك|يركض|يجري|يعطي|يأخذ|يفتح|يغلق|يقول|ينظر|يرقص|يضع|يحمل|يقفز|يدفع|يسحب|يركل|يلكم|يضرب|يتقدم|يتمدد|يستلقي|ينحني|يضغط|يلتف|يقترب|يختنق|يخنق|يقف|يركع|ينام|يقفل|يستيقظ";

/** Rough count of distinct action-verb beats (general — any actions). */
export function countActionVerbs(text: string, arabic: boolean): number {
  if (arabic) {
    const re = new RegExp(
      `(?:^|[\\s،,])((?:${ARABIC_ACTION_VERBS})(?:ه|ها|هم|هن)?)`,
      "g",
    );
    return [...text.matchAll(re)].length;
  }
  const re =
    /\b(punche?s?|lifts?|throws?|catches?|holds?|falls?|walks?|sits?|laughs?|runs?|gives?|takes?|opens?|closes?|kicks?|hugs?|kisses?|jumps?|drops?|grabs?|approaches?|lies|lie|wraps?|chokes?|squeezes?|kneels?|stands?)\b/gi;
  return [...text.matchAll(re)].length;
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

type Gender = "female" | "male" | "unknown";

/** Infer a compact final-pose summary from an action phrase. */
export function inferFinalPose(action: string, arabic: boolean): string {
  const poses = inferCharacterPoses(action, arabic);
  const bits = [poses.female, poses.male].filter(Boolean);
  if (bits.length) return bits.join(arabic ? "؛ " : "; ");
  const a = action.trim();
  if (!a) {
    return arabic ? "الشخصيات في وضعية مستقرة" : "characters in a stable pose";
  }
  return arabic ? `نهاية الحركة السابقة: ${a}` : `end state of previous action: ${a}`;
}

export function inferCharacterPoses(
  action: string,
  arabic: boolean,
): Partial<Record<Gender, string>> {
  const clauses = splitActionClauses(action, arabic);
  let female: string | undefined;
  let male: string | undefined;

  for (const clause of clauses) {
    const c = clause.trim();
    if (!c) continue;
    const actor = detectClauseActor(c, arabic);

    if (arabic) {
      // Separate ifs: one clause may contain throw + handstand together.
      if (/ترفع|يرفع|رفع|حاملا|يحمل|فوق\s*رأس/.test(c) && actor !== "male") {
        female = "الأنثى تحمل الرجل مرفوعاً فوق رأسها";
        male = "الرجل مرفوع في الهواء فوق رأس الأنثى";
      }
      if (/ترم[يى]|يرم[يى]|تقذف|يقذف|قذف/.test(c)) {
        if (!/وقفة\s*يدين|انشقاق/.test(c)) {
          female = "الأنثى بعد حركة الرمي/القذف مباشرة";
        }
        male = "الرجل في الهواء بعد الرمي وقبل السقوط";
      }
      if (/وقفة\s*يدين|handstand|انشقاق/.test(c)) {
        female =
          "الأنثى في وقفة يدين على الأرض مع انشقاق أفقي للساقين وتحافظ على هذه الوضعية";
      }
      if (/يسقط|تسقط|سقوط|ممدد على بطن/.test(c)) {
        if (/منتصف\s*ساق|فوق\s*ساق|على\s*ساق/.test(c) || female?.includes("وقفة يدين")) {
          male =
            "الرجل يسقط ممدداً على بطنه فوق منتصف ساقي الأنثى وهي ما تزال في وقفتها";
          if (female?.includes("وقفة يدين") || /وقفة\s*يدين|انشقاق/.test(c)) {
            female =
              "الأنثى تحافظ على وقفة اليدين والانشقاق الأفقي دون أن تتحرك من وضعيتها";
          }
        } else if (actor === "female") {
          female = "الأنثى بعد السقوط في وضعية جديدة";
        } else {
          male = "الرجل بعد السقوط في وضعية جديدة";
        }
      }
      if (/قفل\s*الجسد/.test(c)) {
        female = female?.includes("وقفة يدين")
          ? `${female} مع قفل الجسد على خصر الرجل`
          : "الأنثى تُقفل الجسد على خصر الرجل";
        male = male?.includes("ممدد")
          ? male
          : "الرجل مُمسَك في وضعية القفل";
      } else if (/تمسك|يمسك|مسك/.test(c) && !/قفل/.test(c)) {
        female = female?.includes("وقفة يدين")
          ? female
          : "الأنثى تُمسك الرجل";
        male = male || "الرجل مُمسَك";
      }
      if (/لكم|يضرب|تسدد|لكمة/.test(c)) {
        female = female || "الأنثى في وضعية اشتباك بعد اللكمة";
        male = male || "الرجل يتلقى الضربة على الوجه/الجسم";
      }
    } else {
      if (/handstand|split/i.test(c)) {
        female = "woman holds a handstand with a full horizontal split";
      } else if (/\blift|raise|overhead\b/i.test(c)) {
        female = "woman holding the man raised overhead";
        male = "man raised in the air above the woman";
      } else if (/\bthrow|toss\b/i.test(c)) {
        male = "man in the air after being thrown";
      } else if (/\bfall|lands?|drops?\b/i.test(c)) {
        if (/mid(?:dle)? of (?:her )?legs|across her legs/i.test(c) || female?.includes("handstand")) {
          male = "man lands belly-down across the middle of her legs";
          female =
            "woman keeps the handstand/split pose unchanged while he lands";
        } else if (actor === "female") {
          female = "woman after the fall";
        } else {
          male = "man after the fall";
        }
      }
    }
  }

  const out: Partial<Record<Gender, string>> = {};
  if (female) out.female = female;
  if (male) out.male = male;
  return out;
}

export function splitActionClauses(action: string, arabic: boolean): string[] {
  const text = stripSequencePrefix(action).trim();
  if (!text) return [];
  const parts = text
    .split(arabic ? CLAUSE_SPLIT_AR : CLAUSE_SPLIT_EN)
    .map((p) => p.trim())
    .filter(Boolean)
    // Lookahead keeps markers on the next clause — strip pure sequence words
    // like leading «ثم» so joiners don't become «ثم ثم». Keep «قبل أن…».
    .map((p) =>
      p
        .replace(/^(?:ثم|وبعدين|بعدين|بعد ذلك|بعدها|وبعدها)\s+/i, "")
        .replace(/^(?:then|and then|after that|afterwards|next)\s+/i, "")
        .trim(),
    )
    .filter(Boolean);
  if (parts.length >= 2) return parts;
  // No explicit ثم/before — split by successive action verbs (context).
  return splitByActionVerbs(text, arabic);
}

/**
 * Split a single paragraph into beats at each new primary action verb.
 * GENERAL for any actions (walk/sit/punch/lift/…); does not require ثم.
 */
export function splitByActionVerbs(text: string, arabic: boolean): string[] {
  const t = text.trim();
  if (!t) return [];
  const re = arabic
    ? new RegExp(
        `(?:^|[\\s،,])((?:${ARABIC_ACTION_VERBS})(?:ه|ها|هم|هن)?)`,
        "g",
      )
    : /\b(punche?s?|lifts?|throws?|catches?|holds?|falls?|walks?|sits?|laughs?|runs?|gives?|takes?|opens?|closes?|kicks?|hugs?|jumps?|drops?|grabs?|approaches?|lies|lie|wraps?|chokes?|squeezes?|kneels?|stands?)\b/gi;

  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    // Start of the verb token (skip leading whitespace capture)
    const verbStart = m.index + (m[0].length - m[1]!.length);
    // Skip very early duplicates / tiny gaps (same beat)
    if (hits.length && verbStart - hits[hits.length - 1]! < 10) continue;
    // "قبل ان يسقط تمسكه" — keep يسقط with following catch; don't split on يسقط after قبل ان
    const before = t.slice(Math.max(0, verbStart - 12), verbStart);
    if (arabic && /قبل\s*ان?\s*$/i.test(before) && /^يسقط|^تسقط/.test(t.slice(verbStart))) {
      continue;
    }
    hits.push(verbStart);
  }

  if (hits.length < 1) return [t];

  // Cut before the first verb when there is a real opening state
  // (e.g. «ممددة على ظهرها…» then «يتقدم نحوها…»).
  const points: number[] = [];
  if (hits[0]! > 8) points.push(0);
  for (const h of hits) {
    if (!points.length || h - points[points.length - 1]! >= 8) points.push(h);
  }
  points.push(t.length);

  if (points.length < 3) return [t]; // need at least 2 segments

  const clauses: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const chunk = t.slice(points[i]!, points[i + 1]!).trim();
    if (chunk.length >= 3) clauses.push(chunk);
  }
  return clauses.length >= 2 ? clauses : [t];
}

/** Prefer keeping handstand / landed locks when merging pose updates. */
function mergePose(
  prev: string | undefined,
  next: string | undefined,
  arabic: boolean,
): string | undefined {
  if (!next) return prev;
  if (!prev) return next;
  const prevHold = /وقفة|انشقاق|handstand|split|ممدد|منتصف|legs/i.test(prev);
  const nextHold = /وقفة|انشقاق|handstand|split|ممدد|منتصف|legs/i.test(next);
  if (prevHold && !nextHold) {
    return arabic ? `${prev}؛ ${next}` : `${prev}; ${next}`;
  }
  if (prevHold && nextHold) return next.length >= prev.length ? next : prev;
  return next;
}

/** Who is the grammatical/primary actor of this clause? */
export function detectClauseActor(clause: string, arabic: boolean): Gender {
  if (arabic) {
    if (/(?:^|[\s،,])(?:الأنثى|الانثى|أنثى|انثى|المرأة|فتاة)\b/.test(clause)) {
      return "female";
    }
    if (/(?:^|[\s،,])(?:الرجل|رجلاً|رجل|شاب)\b/.test(clause)) {
      return "male";
    }
    // Verb gender: تـ = feminine imperfect, يـ = masculine imperfect (common video prompts)
    if (
      /(?:^|[\s،,])(?:تسقط|ترفع|ترمي|تقذف|تمسك|تؤدي|تسدد|تضرب|تقفل|تحافظ|تقوم|تلف)/.test(
        clause,
      )
    ) {
      return "female";
    }
    if (
      /(?:^|[\s،,])(?:يسقط|يرفع|يرمي|يمسك|يؤدي|يسدد|يضرب|يقفل|يقع|يهوي)/.test(
        clause,
      )
    ) {
      return "male";
    }
    if (/ساقيها|رأسها|يديها|جسمها|بطنها|خصرها/.test(clause) && /يسقط|ممدد على بطن/.test(clause)) {
      // "he falls on her legs" — actor is male even if her body is referenced
      return "male";
    }
    return "unknown";
  }

  if (/\b(?:the |a )?woman\b/i.test(clause) || /\bshe\b/i.test(clause)) return "female";
  if (/\b(?:the |a )?man\b/i.test(clause) || /\bhe\b/i.test(clause)) return "male";
  return "unknown";
}

/**
 * GENERAL continuity across ثم/then beats:
 * - Each beat updates only the characters it explicitly moves.
 * - Everyone else keeps their previous state.
 * - The new beat is framed as building on those held states (any action, not
 *   only handstand / body-lock / etc.).
 */
export function applyIntraPromptContinuity(
  action: string,
  entities: string[],
  arabic: boolean,
  genders?: Gender[],
): string {
  const gens: Gender[] =
    genders && genders.length === entities.length
      ? genders
      : entities.map((e) => inferGenderFromPhrase(e));

  const clauses = splitActionClauses(action, arabic);
  if (clauses.length <= 1) {
    return injectEntitiesIntoAction(action, entities, arabic, gens);
  }

  const femalePhrase =
    entities.find((_, i) => gens[i] === "female") ||
    entities.find((e) => inferGenderFromPhrase(e) === "female");
  const malePhrase =
    entities.find((_, i) => gens[i] === "male") ||
    entities.find((e) => inferGenderFromPhrase(e) === "male");

  let lockedFemale: string | undefined;
  let lockedMale: string | undefined;
  const outClauses: string[] = [];

  for (let i = 0; i < clauses.length; i += 1) {
    const raw = clauses[i]!;
    let clause = resolveImplicitSubject(raw, arabic, femalePhrase, malePhrase);
    clause = injectEntitiesIntoAction(clause, entities, arabic, gens);

    const actor = detectClauseActor(raw, arabic);
    const touched = charactersTouchedByClause(raw, arabic, actor);

    // Snapshot prior states BEFORE updating — others must hold these.
    const prevFemale = lockedFemale;
    const prevMale = lockedMale;

    const poses = inferCharacterPoses(clause, arabic);
    const generic = genericPoseFromClause(raw, actor, arabic);
    if (touched.female) {
      lockedFemale = poses.female || generic.female || lockedFemale;
      if (/وقفة\s*يدين|handstand|انشقاق/.test(raw)) {
        lockedFemale = arabic
          ? "وقفة يدين على الأرض مع انشقاق أفقي كامل للساقين"
          : "handstand with a full horizontal split";
      }
    }
    if (touched.male) {
      lockedMale = poses.male || generic.male || lockedMale;
      if (/ممدد على بطن|منتصف\s*ساق/.test(raw)) {
        lockedMale = arabic
          ? "ممدد على بطنه فوق منتصف ساقي الأنثى"
          : "lying belly-down across the middle of her legs";
      }
    }

    const continuity: string[] = [];
    if (i > 0) {
      let describedFemale = false;
      let describedMale = false;

      // Living atmosphere for anyone NOT moved — never meta "previous state".
      if (!touched.female && prevFemale) {
        continuity.push(
          livingHeldAside(femalePhrase || (arabic ? "الأنثى" : "the woman"), prevFemale, "female", arabic, i),
        );
        describedFemale = true;
      }
      if (!touched.male && prevMale) {
        continuity.push(
          livingHeldAside(malePhrase || (arabic ? "الرجل" : "the man"), prevMale, "male", arabic, i),
        );
        describedMale = true;
      }

      // Actor adds a secondary move while still living in an earlier stance.
      if (
        !describedFemale &&
        touched.female &&
        prevFemale &&
        lockedFemale &&
        prevFemale !== lockedFemale &&
        /وقفة|انشقاق|handstand|جلوس|وقوف|stance|pose/i.test(prevFemale) &&
        !/وقفة|انشقاق|handstand|جلوس/.test(raw)
      ) {
        continuity.push(
          livingHeldAside(femalePhrase || (arabic ? "الأنثى" : "the woman"), prevFemale, "female", arabic, i + 23),
        );
        lockedFemale = mergePose(prevFemale, lockedFemale, arabic);
        describedFemale = true;
      }
      if (
        !describedMale &&
        touched.male &&
        prevMale &&
        lockedMale &&
        prevMale !== lockedMale &&
        /ممدد|هواء|رفع|stance|pose|lying|air/i.test(prevMale) &&
        !/يسقط|ممدد|fall|land/.test(raw)
      ) {
        continuity.push(
          livingHeldAside(malePhrase || (arabic ? "الرجل" : "the man"), prevMale, "male", arabic, i + 29),
        );
        lockedMale = mergePose(prevMale, lockedMale, arabic);
        describedMale = true;
      }

    }

    if (continuity.length) {
      outClauses.push(`${clause}، ${continuity.join("، ")}`);
    } else {
      outClauses.push(clause);
    }
  }

  const joiner = arabic ? " ثم " : " then ";
  let idea = outClauses.join(joiner);

  // Close on a vivid held tableau — no "final state" meta wording.
  if (lockedFemale || lockedMale) {
    const bits = [
      lockedFemale
        ? livingTableau(femalePhrase || (arabic ? "الأنثى" : "the woman"), lockedFemale, "female", arabic, 41)
        : "",
      lockedMale
        ? livingTableau(malePhrase || (arabic ? "الرجل" : "the man"), lockedMale, "male", arabic, 43)
        : "",
    ].filter(Boolean);
    idea += arabic
      ? `. وفي اللحظة الأخيرة: ${bits.join("، و")}`
      : `. In the final held moment: ${bits.join(", and ")}`;
  }

  return idea.replace(/\s+/g, " ").trim();
}

type PoseMood =
  | "airborne"
  | "handstand"
  | "overhead_lift"
  | "prone_on_legs"
  | "sitting"
  | "struck"
  | "holding"
  | "generic";

function classifyPose(pose: string): PoseMood {
  const p = pose || "";
  if (/هواء|رمي|قبل السقوط|airborne|thrown|in the air/i.test(p)) return "airborne";
  if (/وقفة\s*يدين|انشقاق|handstand|split/i.test(p)) return "handstand";
  if (/مرفوع|فوق رأس|overhead|lifted/i.test(p)) return "overhead_lift";
  if (/ممدد|منتصف\s*ساق|belly|across.*legs/i.test(p)) return "prone_on_legs";
  if (/يجلس|جلوس|كرسي|sit(?:ting)?/i.test(p)) return "sitting";
  if (/لكمة|ضربة|اشتباك|punch|struck/i.test(p)) return "struck";
  if (/يمسك|تمسك|قفل|hold|lock|catch/i.test(p)) return "holding";
  return "generic";
}

function pickVariant(options: string[], salt: number): string {
  if (!options.length) return "";
  return options[Math.abs(salt) % options.length]!;
}

/** Strip leading "بعد:" wrappers from generic poses. */
function poseCore(pose: string): string {
  return pose.replace(/^(?:بعد|after)\s*:\s*/i, "").trim();
}

/**
 * Living aside for a character who continues their physical/emotional state.
 * GENERAL for every action — vivid atmosphere, never "previous state" meta.
 */
export function livingHeldAside(
  who: string,
  pose: string,
  gender: Gender,
  arabic: boolean,
  salt: number,
): string {
  const mood = classifyPose(pose);
  const female = gender === "female";

  if (arabic) {
    switch (mood) {
      case "airborne":
        return pickVariant(
          [
            `بينما ${who} ما يزال في الهواء فوقها، جسده مرتخي منهك لا يسيطر على توازنه، شعره يتطاير للأعلى، وملامحه متفاجئة فاغرة`,
            `و${who} معلّق في الهواء لحظةً، أطرافه مرتخية، قميصه يرفرف، عيناه متسعتان من المفاجأة`,
            `فيما ${who} يندفع في الهواء، شعره يتطاير، تنفّسه مقطوع، وجهه بين الدهشة والعجز`,
          ],
          salt,
        );
      case "handstand":
        return pickVariant(
          [
            `بينما ${who} ثابتة على يديها في انشقاق أفقي كامل، ساقاها ممدودتان بقوة، عضلات كتفيها مشدودة، وتنفّسها ثابت مركّز`,
            `و${who} ما تزال مقلوبة على يديها، شعرها يتدلّى نحو الأرض، ساقان مفتوحتان بانشقاق حاد، وجسدها صلب كتمثال حي`,
            `فيما ${who} تمسك وقفة اليدين بإتقان، أصابعها تغرس في الأرض، ساقاها مشدودتان أفقياً، ونظرها مركّز رغم انقلاب الجسد`,
          ],
          salt,
        );
      case "overhead_lift":
        return female
          ? pickVariant(
              [
                `بينما ${who} ترفعه فوق رأسها بعضلات مشدودة، ذراعاها ترتجفان خفيفاً من الجهد، وتعبيرها صارم واثق`,
                `و${who} تُثبّته عالياً فوق رأسها، كتفاها مرتفعان، أنفاسها ثقيلة، ونظرها ثابت للأمام`,
              ],
              salt,
            )
          : pickVariant(
              [
                `بينما ${who} مرفوع فوق رأسها، جسده متدلٍّ منهك، قدماه عن الأرض، وشعره يتدلّى مع الجاذبية`,
                `و${who} معلّق في الهواء فوقها عاجزاً عن الحركة، ذراعاه مرتخيتان، ووجهه متعب مذهول`,
              ],
              salt,
            );
      case "prone_on_legs":
        return pickVariant(
          [
            `بينما ${who} ممدّد على بطنه فوق منتصف ساقيها، صدره يلامسها، وجهه قريب من الأرض، وجسده ثقيل بلا مقاومة`,
            `و${who} مستلقٍ ممدوداً على ساقيها، أنفاسه قصيرة، شعره مبعثر على جبينه، ويداه مرتخيتان إلى الجانبين`,
          ],
          salt,
        );
      case "sitting":
        return pickVariant(
          [
            `بينما ${who} ما يزال جالساً على الكرسي، ظهره مستند، يداه مرتاحتان على فخذيه، ونظره يتابع المشهد بثبات`,
            `و${who} جالس في مكانه، كتفه مسترخٍ، قدماه ثابتتان على الأرض، وتعبيره هادئ منتظر`,
          ],
          salt,
        );
      case "struck":
        return pickVariant(
          [
            `بينما ${who} ما يزال يترنّح من أثر الضربة، رأسه مائل، عيناه ضيّقتان، وجسده غير متوازن`,
            `و${who} في لحظة الصدمة بعد الضربة، فكّه مشدود، كتفه متراجع، وتنفّسه متقطّع`,
          ],
          salt,
        );
      case "holding":
        return pickVariant(
          [
            `بينما ${who} يُمسَك بإحكام، عضلاته مشدودة تحت القبضة، وجهه متوتّر، وحركته مقيدة`,
            `و${who} في قبضة محكمة، كتفه مضغوط، تنفّسه ثقيل، ونظره مرتبك`,
          ],
          salt,
        );
      default: {
        const core = poseCore(pose);
        const still = female ? "ما تزال" : "ما يزال";
        const poseWord = female ? "وضعيتها" : "وضعيته";
        const hisHer = female ? "تعبيرها" : "تعبيره";
        const body = female ? "جسدها" : "جسده";
        const carries = female ? "يحمل" : "يحمل";
        return pickVariant(
          [
            `بينما ${who} ${still} في ${poseWord} (${core})، بتفاصيل حيّة في الوجه والشعر وحركة الملابس`,
            `و${who} يظهر بوضوح في (${core})، ${hisHer} متفاعل، و${body} ${carries} توتر اللحظة`,
            `فيما ${who} ${still} ضمن المشهد: ${core}، مع إحساس واقعي بالوزن والتنفّس والمفاجأة`,
          ],
          salt,
        );
      }
    }
  }

  // English
  switch (mood) {
    case "airborne":
      return pickVariant(
        [
          `while ${who} is still mid-air above her, body limp and helpless, hair flying upward, face stunned and open-mouthed`,
          `and ${who} hangs in the air for a beat, limbs loose, shirt fluttering, eyes wide with shock`,
        ],
        salt,
      );
    case "handstand":
      return pickVariant(
        [
          `while ${who} holds a perfect handstand with a full horizontal split, shoulders locked, breath steady and focused`,
          `and ${who} stays inverted on her hands, hair hanging toward the floor, legs stretched in a sharp split`,
        ],
        salt,
      );
    case "prone_on_legs":
      return pickVariant(
        [
          `while ${who} lies belly-down across mid-legs, heavy and unresistant, breath short, hair messy on his brow`,
        ],
        salt,
      );
    case "sitting":
      return pickVariant(
        [
          `while ${who} remains seated on the chair, back supported, hands resting, gaze following the moment`,
        ],
        salt,
      );
    default:
      return `while ${who} is still in (${poseCore(pose)}), with vivid face, hair, and clothing motion`;
  }
}

function livingTableau(
  who: string,
  pose: string,
  gender: Gender,
  arabic: boolean,
  salt: number,
): string {
  const mood = classifyPose(pose);
  if (arabic) {
    if (mood === "handstand") {
      return `${who} ثابتة على يديها بانشقاق أفقي كامل، جسدها مشدود كتمثال حي`;
    }
    if (mood === "prone_on_legs") {
      return `${who} ممدّد على بطنه فوق منتصف ساقيها، ثقيل بلا مقاومة`;
    }
    if (mood === "airborne") {
      return `${who} ما يزال في الهواء، شعره يتطاير، ووجهه متفاجئ`;
    }
    if (mood === "overhead_lift") {
      return gender === "female"
        ? `${who} ترفعه فوق رأسها بعضلات مشدودة ونظر واثق`
        : `${who} مرفوع فوق رأسها، منهك وشعره يتدلّى مع الجاذبية`;
    }
    const core = poseCore(pose)
      .replace(/^(?:الأنثى|الانثى|أنثى|الرجل|رجل)\s*/i, "")
      .trim();
    return `${who} ${core || "في وضعية واضحة"}، بتفاصيل حيّة في التعبير والجسد`;
  }
  return `${who} in ${poseCore(pose)}, with vivid expression and body detail`;
}

/**
 * Who this clause actively moves. Possessive body references as a surface
 * (ساقيها / على رأسها) do NOT count as moving that person — they hold still.
 */
function charactersTouchedByClause(
  clause: string,
  arabic: boolean,
  actor: Gender,
): { female: boolean; male: boolean } {
  // Object pronouns: ترفعه / ترميه / تقذفه → male is moved even if actor is female
  if (arabic && /(?:ترفعه|ترميه|تقذفه|تمسكه|تضعه|تحمله|تلف|تلقّاه|تتلقاه)/.test(clause)) {
    return {
      female:
        actor === "female" ||
        /(?:تؤدي|ترفع|ترمي|تقذف|تمسك|تسدد|تلف)/.test(clause),
      male: true,
    };
  }
  if (!arabic && /\b(?:lifts?|throws?|holds?|catches?)\s+him\b/i.test(clause)) {
    return { female: true, male: true };
  }

  const femaleActive = arabic
    ? /(?:^|[\s،,])(?:الأنثى|الانثى|أنثى|انثى|المرأة|فتاة)|(?:تسقط|ترفع|ترمي|تقذف|تمسك|تؤدي|تسدد|تضرب|تقفل|تقوم|تحافظ|تلف)/.test(
        clause,
      )
    : /\b(?:woman|she)\b/i.test(clause);
  const maleActive = arabic
    ? /(?:^|[\s،,])(?:الرجل|رجلاً|رجل|شاب)|(?:يسقط|يرفع|يرمي|يمسك|يضرب|يقع|يهوي|ممدد على بطن)/.test(
        clause,
      )
    : /\b(?:man|he)\b/i.test(clause);

  if (actor === "female") return { female: true, male: maleActive };
  if (actor === "male") return { female: femaleActive, male: true };
  return { female: femaleActive, male: maleActive };
}

function genericPoseFromClause(
  clause: string,
  actor: Gender,
  arabic: boolean,
): Partial<Record<Gender, string>> {
  const short = clause.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!short) return {};
  if (arabic) {
    if (actor === "female") return { female: `بعد: ${short}` };
    if (actor === "male") return { male: `بعد: ${short}` };
    return { female: `بعد: ${short}`, male: `بعد: ${short}` };
  }
  if (actor === "female") return { female: `after: ${short}` };
  if (actor === "male") return { male: `after: ${short}` };
  return { female: `after: ${short}`, male: `after: ${short}` };
}

/** If a clause has a gendered verb but no person noun, insert the matching entity. */
function resolveImplicitSubject(
  clause: string,
  arabic: boolean,
  femalePhrase?: string,
  malePhrase?: string,
): string {
  const c = clause.trim();
  if (!c) return c;

  if (arabic) {
    const hasFemaleNoun = /الأنثى|الانثى|أنثى|انثى|المرأة|فتاة/.test(c);
    const hasMaleNoun = /الرجل|رجلاً|رجل|شاب/.test(c);
    // Already has a concrete long entity phrase
    const hasConcrete =
      (femalePhrase && c.includes(femalePhrase.slice(0, 12))) ||
      (malePhrase && c.includes(malePhrase.slice(0, 12)));

    if (hasConcrete || (hasFemaleNoun && hasMaleNoun)) return c;

    // JS \b is ASCII-only — use whitespace/end anchors for Arabic verbs.
    if (/^(?:يسقط|يرفع|يرمي|يمسك|يقع|يهوي|يضرب)(?:\s|$)/.test(c) && !hasMaleNoun && malePhrase) {
      return `${malePhrase} ${c}`;
    }
    if (
      /^(?:تسقط|ترفع|ترمي|تمسك|تؤدي|تسدد|تضرب|تقفل)(?:\s|$)/.test(c) &&
      !hasFemaleNoun &&
      femalePhrase
    ) {
      return `${femalePhrase} ${c}`;
    }
  } else {
    const hasWoman = /\b(?:the |a )?woman\b/i.test(c) || /\bshe\b/i.test(c);
    const hasMan = /\b(?:the |a )?man\b/i.test(c) || /\bhe\b/i.test(c);
    if (/^falls?\b/i.test(c) && !hasMan && malePhrase) return `${malePhrase} ${c}`;
    if (/^(?:does|performs|holds)\b/i.test(c) && !hasWoman && femalePhrase) {
      return `${femalePhrase} ${c}`;
    }
  }

  return c;
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

  const grounded = entities.length
    ? applyIntraPromptContinuity(rawAction, entities, arabic, genders)
    : rawAction;

  if (!sequential || !input.previous?.finalPose) {
    return { chained: false, idea: grounded };
  }

  const prevChars = input.previous.characterPoses;
  const femaleWho =
    entities.find((_, i) => genders[i] === "female") ||
    (arabic ? "الأنثى" : "the woman");
  const maleWho =
    entities.find((_, i) => genders[i] === "male") ||
    (arabic ? "الرجل" : "the man");

  const livingOpen: string[] = [];
  if (prevChars?.female) {
    livingOpen.push(livingTableau(femaleWho, prevChars.female, "female", arabic, 3));
  }
  if (prevChars?.male) {
    livingOpen.push(livingTableau(maleWho, prevChars.male, "male", arabic, 5));
  }

  if (arabic) {
    return {
      chained: true,
      idea: [
        livingOpen.length
          ? `المشهد متصل حيّاً: ${livingOpen.join("، و")}`
          : `المشهد متصل بحركة طبيعية دون إعادة تهيئة`,
        `ثم ينساب إلى: ${grounded}`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    chained: true,
    idea: [
      livingOpen.length
        ? `The scene continues live: ${livingOpen.join(", and ")}`
        : `The scene continues naturally without a reset`,
      `then flows into: ${grounded}`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

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
      // Skip matches that sit inside an already-concrete entity phrase span
      // (e.g. "أنثى" inside "أنثى طويلة ترتدي…") — handled by occupied after first replace pass.
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

/**
 * Pick entity by gender. Same-gender entities may be reused across many clauses
 * (critical for long ثم…ثم… prompts). Never fall back to the opposite gender.
 */
function pickEntityIndex(hit: GenericHit, genders: Gender[], entities: string[]): number {
  // Exact unused gender match first (for "another man/woman")
  if (hit.secondary) {
    for (let i = 0; i < genders.length; i += 1) {
      if (hit.gender !== "unknown" && genders[i] === hit.gender && i > 0) return i;
    }
  }

  for (let i = 0; i < genders.length; i += 1) {
    if (hit.gender !== "unknown" && genders[i] === hit.gender) return i;
  }

  // Phrase-based gender if structured genders missing/wrong
  for (let i = 0; i < entities.length; i += 1) {
    if (hit.gender !== "unknown" && inferGenderFromPhrase(entities[i]!) === hit.gender) {
      return i;
    }
  }

  if (hit.gender === "unknown") {
    return hit.secondary ? Math.min(1, entities.length - 1) : 0;
  }

  // No matching gender — refuse opposite-gender swap; keep original noun by returning -1
  return -1;
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

  // Protect already-concrete phrases so inner "أنثى"/"رجل" aren't re-matched
  const protectedRanges: Array<[number, number]> = [];
  for (const phrase of entities) {
    if (!phrase || phrase.length < 8) continue;
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(phrase, from);
      if (at < 0) break;
      protectedRanges.push([at, at + phrase.length]);
      from = at + phrase.length;
    }
  }

  const hits = (arabic ? collectArabicGenerics(text) : collectEnglishGenerics(text)).filter(
    (h) => !protectedRanges.some(([a, b]) => h.start >= a && h.end <= b),
  );
  if (!hits.length) {
    return text;
  }

  const replacements: Array<{ start: number; end: number; value: string }> = [];

  for (const hit of hits) {
    const idx = pickEntityIndex(hit, gens, entities);
    if (idx < 0) continue; // keep original generic rather than wrong gender
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
  const characterPoses = {
    ...input.previous?.characterPoses,
    ...inferCharacterPoses(actionCore, arabic),
  };
  return {
    arabic,
    entities,
    entityGenders:
      input.entityGenders ||
      input.previous?.entityGenders ||
      entities.map((e) => inferGenderFromPhrase(e)),
    finalPose: inferFinalPose(actionCore, arabic),
    characterPoses,
    lastAction: actionCore,
    setting: input.setting || input.previous?.setting,
    updatedAt: new Date().toISOString(),
  };
}
