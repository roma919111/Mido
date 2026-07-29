/**
 * Veronix timed shot script — verb / subject-state / object beats
 * packed into the chosen clip duration (single prompt, not multi-generate).
 */

import {
  countActionVerbs,
  splitActionClauses,
  splitByActionVerbs,
} from "@/lib/prompt-chain";

export type ShotRole = "action" | "subject_state" | "object";

export type TimedBeat = {
  index: number;
  startSec: number;
  endSec: number;
  role: ShotRole;
  /** Arabic line for the recommendation UI */
  labelAr: string;
  /** Action text used inside the generation script (same language as customer) */
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
const OBJECT_SECONDS = 1;
const CYCLE = ACTION_SECONDS + STATE_SECONDS + OBJECT_SECONDS; // 4

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
  return clauses.slice(0, 8);
}

function roleLabelAr(role: ShotRole, action: string): string {
  if (role === "action") return action;
  if (role === "subject_state") return `حالة الفاعل أثناء: ${action}`;
  return `المفعول به / نتيجة: ${action}`;
}

function roleText(role: ShotRole, action: string, arabic: boolean): string {
  if (role === "action") return action;
  if (arabic) {
    if (role === "subject_state") {
      return `لقطة قريبة على حالة الفاعل أثناء: ${action}`;
    }
    return `ركز على المفعول به / نتيجة: ${action}`;
  }
  if (role === "subject_state") {
    return `Close beat on the subject's state while: ${action}`;
  }
  return `Beat focused on the object / result of: ${action}`;
}

/**
 * Pack timed beats into `totalSeconds`:
 * each cycle = action 2s → subject state 1s → object 1s, then repeat.
 */
export function buildVeronixShotScript(input: {
  originalPrompt: string;
  /** Optional AI-enhanced prompt (same language preferred for scriptPrompt). */
  enhancedPrompt?: string;
  totalSeconds: number;
}): VeronixShotScript {
  const totalSeconds = Math.max(
    1,
    Math.min(60, Math.round(Number(input.totalSeconds) || 4)),
  );
  const actions = extractActionBeats(input.originalPrompt);
  const enhanced = (input.enhancedPrompt || "").trim();
  const arabic =
    isArabic(enhanced) ||
    isArabic(input.originalPrompt) ||
    actions.some((a) => isArabic(a));
  const beats: TimedBeat[] = [];
  let t = 0;
  let actionIdx = 0;

  while (t < totalSeconds) {
    const action =
      actions[actionIdx % actions.length] || cleanCore(input.originalPrompt);
    actionIdx += 1;
    const remaining = totalSeconds - t;

    const slots: Array<{ role: ShotRole; want: number }> = [
      { role: "action", want: Math.min(ACTION_SECONDS, remaining) },
      {
        role: "subject_state",
        want: Math.min(STATE_SECONDS, Math.max(0, remaining - ACTION_SECONDS)),
      },
      {
        role: "object",
        want: Math.min(
          OBJECT_SECONDS,
          Math.max(0, remaining - ACTION_SECONDS - STATE_SECONDS),
        ),
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
        labelAr: roleLabelAr(slot.role, action),
        text: roleText(slot.role, action, arabic),
      });
      t = endSec;
    }

    // Safety: if a cycle couldn't advance (edge case), consume 1s as action.
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
        timelineAr,
        "حافظ على الاستمرارية بين اللقطات. حركة سينمائية طبيعية. فيديو واحد متصل.",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        sceneCore,
        "",
        "Veronix timed shot script — follow this exact pacing inside one continuous clip:",
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
