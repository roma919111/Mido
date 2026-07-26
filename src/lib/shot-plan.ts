/**
 * General multi-shot planner for ANY sequential action prompt.
 *
 * Understands context without requiring the user to type ثم:
 * - temporal markers (ثم / قبل أن / بعد أن / then / before…)
 * - successive action verbs (يمشي → يجلس → يضحك, or punch → catch → lift)
 * - optional Gemini beat inference when rules are unsure
 */

import {
  countActionVerbs,
  detectClauseActor,
  inferCharacterPoses,
  livingHeldAside,
  splitActionClauses,
  splitByActionVerbs,
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

/** Product cap: up to 15 beats × 2s = 30s stitched video. */
export const MAX_SHOTS = 15;
/** Final length of each beat after trim (OpenArt may render longer if model min > 2). */
export const PRODUCT_PER_SHOT_SECONDS = 2;
export const MAX_TOTAL_SECONDS = MAX_SHOTS * PRODUCT_PER_SHOT_SECONDS;
const DEFAULT_PER_SHOT_SECONDS = PRODUCT_PER_SHOT_SECONDS;

/** Strip cinematic wrapper / trailing polish so splitting sees the action chain. */
export function extractActionBody(prompt: string): {
  body: string;
  prefix: string;
  suffix: string;
  arabic: boolean;
} {
  const raw = prompt.trim();
  const arabic = /[\u0600-\u06FF]/.test(raw);

  let body = raw
    .replace(/^مشهد سينمائي واقعي:\s*/i, "")
    .replace(/^صورة سينمائية واقعية:\s*/i, "")
    .replace(/^Cinematic realistic (?:scene|image):\s*/i, "");

  // Drop numbered shot script headers if re-enhancing
  body = body.replace(/^\[?\s*لقطة\s*\d+\s*\]?\s*[:：\-]?\s*/gim, "");
  body = body.replace(/^\[?\s*Shot\s*\d+\s*\]?\s*[:：\-]?\s*/gim, "");
  // Strip single-shot polish so re-plan can see the full action chain
  body = body.replace(
    /لقطة\s*واحدة?\s*فقط[^.]*\.?/gi,
    "",
  );
  body = body.replace(
    /one shot only[^.]*\.?/gi,
    "",
  );
  body = body.replace(
    /فعل أساسي واحد واضح[^.]*\.?/gi,
    "",
  );
  body = body.replace(
    /بدون سرد باقي المشهد\.?/gi,
    "",
  );

  const suffixMatch = body.match(
    /\.\s*(?:المكان كما في الصورة|حافظ على نفس|Setting matches|Keep the exact|تفاصيل وجه|دفعة كاميرا|إضاءة|مشهد سينمائي واقعي،|وفي اللحظة الأخيرة|In the final held moment)[\s\S]*$/i,
  );
  let suffix = "";
  if (suffixMatch) {
    suffix = suffixMatch[0].replace(/^\.\s*/, "").trim();
    body = body.slice(0, suffixMatch.index).trim();
  }

  body = body.replace(/\.\s*وفي اللحظة الأخيرة:[\s\S]*$/i, "").trim();
  body = body.replace(/\.\s*In the final held moment:[\s\S]*$/i, "").trim();

  return {
    body,
    prefix: arabic ? "مشهد سينمائي واقعي" : "Cinematic realistic scene",
    suffix,
    arabic,
  };
}

function envKey(name: string): string | undefined {
  try {
    return process.env[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Ask Gemini to split ANY multi-action narration into ordered beats (no ثم required). */
export async function inferBeatsWithGemini(text: string, arabic: boolean): Promise<string[] | null> {
  const key = envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY");
  if (!key) return null;
  const model = envKey("GEMINI_VISION_MODEL") || "gemini-flash-lite-latest";

  const instruction = arabic
    ? `قسّم النص التالي إلى لقطات فيديو متتالية (beats). كل لقطة = فعل أساسي واحد واضح.
قاعدة عامة لأي نوع أفعال (مشي، جلوس، قتال، رقص، …) — ليس مشهداً محدداً.
لا تشترط وجود كلمة «ثم». افهم التسلسل من السياق (قبل أن، بعد، ثم فعل جديد، …).
أعد JSON فقط بهذا الشكل: {"beats":["...","..."]}
بدون دمج فعلين قويين في لقطة واحدة. حد أقصى 15 لقطة. كل لقطة فعل واحد (تقدم، تمدد، لف، اختناق، …).`
    : `Split the following narration into ordered video beats. Each beat = one clear primary action.
GENERAL for any actions (walk, sit, fight, dance, approach, wrap, choke, …) — not a specific scene type.
Do NOT require the word "then". Infer sequence from context (before, after, new verb, …).
Return JSON only: {"beats":["...","..."]}
Do not merge two strong actions into one beat. Max 15 beats.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${instruction}\n\nTEXT:\n${text.slice(0, 4000)}` }],
            },
          ],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { beats?: unknown };
    const beats = Array.isArray(parsed.beats)
      ? parsed.beats
          .filter((b): b is string => typeof b === "string" && b.trim().length >= 3)
          .map((b) => b.trim())
          .slice(0, MAX_SHOTS)
      : [];
    return beats.length >= 2 ? beats : null;
  } catch {
    return null;
  }
}

function collectClauses(body: string, arabic: boolean): string[] {
  const byMarkers = splitActionClauses(body, arabic).filter((c) => c.length >= 3);
  if (byMarkers.length >= 2) {
    // Further split any marker-chunk that still packs multiple verbs
    const expanded: string[] = [];
    for (const chunk of byMarkers) {
      const sub = splitByActionVerbs(chunk, arabic);
      if (sub.length >= 2) expanded.push(...sub);
      else expanded.push(chunk);
    }
    return expanded.filter((c) => c.length >= 3);
  }
  return splitByActionVerbs(body, arabic).filter((c) => c.length >= 3);
}

function buildPlanFromClauses(
  clauses: string[],
  options: {
    maxShots: number;
    perShotSeconds: number;
    prefix: string;
    suffix: string;
    arabic: boolean;
    previousState?: SceneState | null;
    reason: string;
    originalPrompt: string;
  },
): ShotPlan {
  const {
    maxShots,
    perShotSeconds,
    prefix,
    suffix,
    arabic,
    previousState,
    reason,
    originalPrompt,
  } = options;

  if (clauses.length < 2) {
    return {
      multiShot: false,
      shotCount: 1,
      perShotSeconds,
      shots: [{ index: 0, action: clauses[0] || originalPrompt, prompt: originalPrompt.trim() }],
      reason: "single_action",
    };
  }

  const heads = clauses.slice(0, maxShots - 1);
  const tail = clauses.slice(maxShots - 1);
  const normalized =
    tail.length > 1
      ? [...heads, tail.join(arabic ? " ثم " : " then ")]
      : [...heads, ...tail];

  let lockedFemale: string | undefined = previousState?.characterPoses?.female;
  let lockedMale: string | undefined = previousState?.characterPoses?.male;

  const shots: PlannedShot[] = normalized.map((clause, index) => {
    const actor = detectClauseActor(clause, arabic);
    const poses = inferCharacterPoses(clause, arabic);
    const prevFemale = lockedFemale;
    const prevMale = lockedMale;

    if (poses.female || actor === "female") {
      lockedFemale = poses.female || lockedFemale || (arabic ? `بعد: ${clause}` : `after: ${clause}`);
    }
    if (poses.male || actor === "male") {
      lockedMale = poses.male || lockedMale || (arabic ? `بعد: ${clause}` : `after: ${clause}`);
    }
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
      const femaleMoving =
        actor === "female" ||
        /ترفع|ترمي|تقذف|تمسك|تؤدي|تسدد|تضرب|تقفل|تلف|تسقط|تمشي|تجلس|تضحك|تعطي/.test(clause);
      const maleMoving =
        actor === "male" ||
        /يرفع|يرمي|يمسك|يسقط|ممدد|تقذفه|ترفعه|ترميه|تمسكه|يمشي|يجلس|يضحك/.test(clause);

      if (!femaleMoving && prevFemale) {
        holds.push(livingHeldAside(arabic ? "الأنثى" : "the woman", prevFemale, "female", arabic, index));
      }
      if (!maleMoving && prevMale) {
        holds.push(livingHeldAside(arabic ? "الرجل" : "the man", prevMale, "male", arabic, index + 7));
      }
    }

    // Keep each shot prompt lean — one action + living holds + setting lock only
    const actionLine = [clause, ...holds].filter(Boolean).join(arabic ? "، " : ", ");
    const settingLock = suffix
      ? suffix
          .split(/(?<=\.)\s+/)
          .filter((line) =>
            /المكان كما في الصورة|Setting matches|حافظ على نفس|Keep the exact/.test(line),
          )
          .slice(0, 2)
          .join(" ")
      : "";

    const parts = [
      `${prefix}: ${actionLine}`,
      arabic
        ? "لقطة واحدة فقط، فعل أساسي واحد واضح، بدون سرد باقي المشهد"
        : "one shot only, a single clear primary action, do not narrate the rest of the scene",
      settingLock,
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
    reason,
  };
}

/** Sync planner (rules + verb context). */
export function planShotSequence(
  prompt: string,
  options: {
    maxShots?: number;
    perShotSeconds?: number;
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

  const clauses = collectClauses(body, arabic);
  return buildPlanFromClauses(clauses, {
    maxShots,
    perShotSeconds,
    prefix,
    suffix,
    arabic,
    previousState: options.previousState,
    reason: clauses.length >= 2 ? "context_beats" : "single_action",
    originalPrompt: prompt,
  });
}

/**
 * Async planner: rules first, then Gemini if the text looks multi-action
 * but rules only found one beat.
 */
export async function planShotSequenceAsync(
  prompt: string,
  options: {
    maxShots?: number;
    perShotSeconds?: number;
    forceSingle?: boolean;
    previousState?: SceneState | null;
  } = {},
): Promise<ShotPlan> {
  const base = planShotSequence(prompt, options);
  if (base.multiShot || options.forceSingle) return base;

  const { body, prefix, suffix, arabic } = extractActionBody(prompt);
  if (countActionVerbs(body, arabic) < 2 && body.length < 80) return base;

  const llmBeats = await inferBeatsWithGemini(body, arabic);
  if (llmBeats && llmBeats.length >= 2) {
    return buildPlanFromClauses(llmBeats, {
      maxShots: options.maxShots ?? MAX_SHOTS,
      perShotSeconds: options.perShotSeconds ?? DEFAULT_PER_SHOT_SECONDS,
      prefix,
      suffix,
      arabic,
      previousState: options.previousState,
      reason: "gemini_context_beats",
      originalPrompt: prompt,
    });
  }
  return base;
}

/** Human-readable shot script for the prompt field after enhance. */
export function formatShotScript(plan: ShotPlan, arabic: boolean): string {
  if (!plan.multiShot || plan.shotCount < 2) {
    return plan.shots[0]?.prompt || "";
  }
  const lines = plan.shots.map((s, i) => {
    const label = arabic ? `لقطة ${i + 1}` : `Shot ${i + 1}`;
    return `${label}: ${s.action}`;
  });
  const note = arabic
    ? "\n\n(سيتم توليد كل لقطة على حدة ثم دمجها تلقائياً)"
    : "\n\n(Each shot will be generated separately then stitched.)";
  return lines.join("\n") + note;
}

export function shouldAutoMultiShot(
  plan: ShotPlan,
  opts: { freeTrial?: boolean; media?: string },
): boolean {
  if (opts.media && opts.media !== "video") return false;
  if (opts.freeTrial) return false;
  return plan.multiShot && plan.shotCount >= 2;
}

/**
 * Product timing: each beat ends at 2s (trimmed), up to 15 beats = 30s.
 * If the model cannot render under 2s, we still request its minimum then trim.
 */
export function recommendShotTiming(
  shotCount: number,
  modelMin = 4,
  modelMax = 15,
): {
  preferredPerShot: number;
  preferredTotalSeconds: number;
  /** Final seconds per shot after trim (always product 2s). */
  perShotSeconds: number;
  totalSeconds: number;
  /** Duration sent to the video model (may be > 2 when model min is higher). */
  apiPerShotSeconds: number;
  clampedToModelMin: boolean;
  labelAr: string;
  labelEn: string;
} {
  const n = Math.min(MAX_SHOTS, Math.max(1, Math.floor(shotCount)));
  const preferredPerShot = PRODUCT_PER_SHOT_SECONDS;
  const preferredTotalSeconds = preferredPerShot * n;
  const perShotSeconds = PRODUCT_PER_SHOT_SECONDS;
  const totalSeconds = Math.min(MAX_TOTAL_SECONDS, perShotSeconds * n);
  const apiPerShotSeconds = Math.min(
    modelMax,
    Math.max(modelMin, PRODUCT_PER_SHOT_SECONDS),
  );
  const clampedToModelMin = apiPerShotSeconds > PRODUCT_PER_SHOT_SECONDS;
  const labelAr = clampedToModelMin
    ? `توصية: ${n} لقطات × ${preferredPerShot} ثوانٍ = ${totalSeconds} ثانية (قصّ كل لقطة إلى ${preferredPerShot}ث؛ الموديل يولّد ${apiPerShotSeconds}ث كحد أدنى)`
    : `توصية: ${n} لقطات × ${perShotSeconds} ثوانٍ = ${totalSeconds} ثانية إجمالي`;
  const labelEn = clampedToModelMin
    ? `Recommend: ${n}×${preferredPerShot}s = ${totalSeconds}s (trim each beat to ${preferredPerShot}s; model min render ${apiPerShotSeconds}s)`
    : `Recommend: ${n}×${perShotSeconds}s = ${totalSeconds}s total`;
  return {
    preferredPerShot,
    preferredTotalSeconds,
    perShotSeconds,
    totalSeconds,
    apiPerShotSeconds,
    clampedToModelMin,
    labelAr,
    labelEn,
  };
}
