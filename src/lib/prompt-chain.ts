/**
 * State continuity / prompt chaining for sequential action prompts.
 *
 * GENERAL RULE (not tied to any specific move like handstand/body-lock):
 * After each beat, every character ends in a state. The next beat builds on
 * those states. Anyone whose action is not explicitly changed MUST keep their
 * previous state; the new action is physically relative to that held state.
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
  /^(ثم|وبعدين|بعدين|بعد ذلك|بعدها|بعدما|بعد\s+أن|وبعد\s+ذلك|و\s*بعدها|وبعدها)\s+/i;
const SEQUENCE_EN =
  /^(then|and then|after that|afterwards|afterward|next|and next|subsequently)\s+/i;

/** Split a compound action into ordered beats (ثم / then). */
const CLAUSE_SPLIT_AR =
  /\s*(?:ثم|وبعدين|بعدين|بعد ذلك|بعدها|وبعدها|و\s*بعدها)\s+/i;
const CLAUSE_SPLIT_EN =
  /\s*(?:and then|then|after that|afterwards|afterward|next|subsequently)\s+/i;

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
      if (/ترم[يى]|يرم[يى]|قذف/.test(c)) {
        if (!/وقفة\s*يدين|انشقاق/.test(c)) {
          female = "الأنثى بعد حركة الرمي مباشرة";
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
    .filter(Boolean);
  return parts.length ? parts : [text];
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
      /(?:^|[\s،,])(?:تسقط|ترفع|ترمي|تمسك|تؤدي|تسدد|تضرب|تقفل|تحافظ|تقوم)/.test(
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
      // Rule: anyone not moved by this beat keeps prior state.
      if (!touched.female && prevFemale) {
        continuity.push(
          arabic
            ? `بينما ${femalePhrase || "الأنثى"} تحافظ تماماً على حالتها السابقة (${prevFemale}) دون تغيير`
            : `while ${femalePhrase || "the woman"} fully maintains her previous state (${prevFemale})`,
        );
      }
      if (!touched.male && prevMale) {
        continuity.push(
          arabic
            ? `بينما ${malePhrase || "الرجل"} يحافظ تماماً على حالته السابقة (${prevMale}) دون تغيير`
            : `while ${malePhrase || "the man"} fully maintains his previous state (${prevMale})`,
        );
      }

      // Even when the actor moves, the OTHER's held state is the base of the new action.
      if (touched.female && !touched.male && prevMale) {
        continuity.push(
          arabic
            ? `وهذا الفعل مبني مباشرة على حالة ${malePhrase || "الرجل"} السابقة (${prevMale})`
            : `and this action builds directly on ${malePhrase || "the man"}'s previous state (${prevMale})`,
        );
      }
      if (touched.male && !touched.female && prevFemale) {
        continuity.push(
          arabic
            ? `وهذا الفعل مبني مباشرة على حالة ${femalePhrase || "الأنثى"} السابقة (${prevFemale})`
            : `and this action builds directly on ${femalePhrase || "the woman"}'s previous state (${prevFemale})`,
        );
      }

      // If the actor also still holds an earlier pose component (e.g. adds a move
      // while remaining in a stance), say so when prior pose exists and clause
      // doesn't clearly replace the whole body stance.
      if (
        touched.female &&
        prevFemale &&
        lockedFemale &&
        prevFemale !== lockedFemale &&
        /وقفة|انشقاق|handstand|جلوس|وقوف|stance|pose/i.test(prevFemale) &&
        !/وقفة|انشقاق|handstand|جلوس/.test(raw)
      ) {
        continuity.push(
          arabic
            ? `مع بقائها في ${prevFemale}`
            : `while remaining in ${prevFemale}`,
        );
        lockedFemale = mergePose(prevFemale, lockedFemale, arabic);
      }
      if (
        touched.male &&
        prevMale &&
        lockedMale &&
        prevMale !== lockedMale &&
        /ممدد|هواء|رفع|stance|pose|lying|air/i.test(prevMale) &&
        !/يسقط|ممدد|fall|land/.test(raw)
      ) {
        continuity.push(
          arabic
            ? `مع بقائه في ${prevMale}`
            : `while remaining in ${prevMale}`,
        );
        lockedMale = mergePose(prevMale, lockedMale, arabic);
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

  // Always close with the held final states of everyone we tracked.
  if (lockedFemale || lockedMale) {
    if (arabic) {
      const bits = [
        lockedFemale
          ? `${femalePhrase || "الأنثى"} تبقى في حالتها النهائية (${lockedFemale})`
          : "",
        lockedMale
          ? `${malePhrase || "الرجل"} يبقى في حالته النهائية (${lockedMale})`
          : "",
      ].filter(Boolean);
      idea += `. الحالة النهائية الثابتة: ${bits.join("، ")}`;
    } else {
      const bits = [
        lockedFemale
          ? `${femalePhrase || "the woman"} remains in final state (${lockedFemale})`
          : "",
        lockedMale
          ? `${malePhrase || "the man"} remains in final state (${lockedMale})`
          : "",
      ].filter(Boolean);
      idea += `. Final held state: ${bits.join("; ")}`;
    }
  }

  return idea.replace(/\s+/g, " ").trim();
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
  // Object pronouns: ترفعه / ترميه → male is moved even if actor is female
  if (arabic && /(?:ترفعه|ترميه|تمسكه|تضعه|تحمله|تلقّاه|تتلقاه)/.test(clause)) {
    return { female: actor === "female" || /(?:تؤدي|ترفع|ترمي|تمسك|تسدد)/.test(clause), male: true };
  }
  if (!arabic && /\b(?:lifts?|throws?|holds?|catches?)\s+him\b/i.test(clause)) {
    return { female: true, male: true };
  }

  const femaleActive = arabic
    ? /(?:^|[\s،,])(?:الأنثى|الانثى|أنثى|انثى|المرأة|فتاة)|(?:تسقط|ترفع|ترمي|تمسك|تؤدي|تسدد|تضرب|تقفل|تقوم|تحافظ)/.test(
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

  // Multi-beat prompts (ثم… ثم…) get pose continuity even on first enhance.
  const multiBeat = splitActionClauses(rawAction, arabic).length > 1;
  const grounded = entities.length
    ? applyIntraPromptContinuity(rawAction, entities, arabic, genders)
    : rawAction;

  if (!sequential || !input.previous?.finalPose) {
    return { chained: false, idea: grounded };
  }

  const prevPose = input.previous.finalPose;
  const prevChars = input.previous.characterPoses;
  const holdBits: string[] = [];
  if (prevChars?.female) {
    holdBits.push(
      arabic
        ? `الأنثى تبدأ من: ${prevChars.female}`
        : `woman starts from: ${prevChars.female}`,
    );
  }
  if (prevChars?.male) {
    holdBits.push(
      arabic
        ? `الرجل يبدأ من: ${prevChars.male}`
        : `man starts from: ${prevChars.male}`,
    );
  }

  if (arabic) {
    return {
      chained: true,
      idea: [
        `بدءاً من الحالة النهائية السابقة (${prevPose})`,
        holdBits.length ? holdBits.join("؛ ") : "",
        `ينتقل المشهد بسلاسة إلى: ${grounded}`,
        "بدون إعادة تهيئة المشهد من الصفر، مع الحفاظ على وضعيات الشخصيات غير المذكورة كمتغيّرة",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    chained: true,
    idea: [
      `Starting from the previous final state (${prevPose})`,
      holdBits.length ? holdBits.join("; ") : "",
      `the scene transitions smoothly into: ${grounded}`,
      "without resetting the scene, preserving any character pose not explicitly changed",
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
