import { NextResponse } from "next/server";
import {
  enhancePrompt,
  enhancePromptVariant,
  enhancePromptWithContext,
  extractCoreIdea,
  type SceneState,
} from "@/lib/prompt-enhance";
import { injectEntitiesIntoAction } from "@/lib/prompt-chain";
import {
  formatShotScript,
  planShotSequenceAsync,
  type PlannedShot,
} from "@/lib/shot-plan";
import type { GenerationMode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type EnhanceBody = {
  prompt?: string;
  mode?: GenerationMode | string;
  imageUrls?: string[];
  previousState?: SceneState | null;
  forceChain?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnhanceBody;
    const prompt = body.prompt?.trim() ?? "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const mode = body.mode ?? "text-to-image";
    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
      : [];

    const result = await enhancePromptWithContext(prompt, String(mode), {
      imageUrls,
      previousState: body.previousState || null,
      forceChain: Boolean(body.forceChain),
    });

    const enhancedFull = result.enhanced || enhancePrompt(prompt, String(mode));
    const arabic = /[\u0600-\u06FF]/.test(result.coreIdea || prompt);
    const isVideo = String(mode).includes("video");

    // Plan from the USER's original prompt (not final scene state).
    let shotPlan = null as Awaited<ReturnType<typeof planShotSequenceAsync>> | null;
    let shots: PlannedShot[] = [];
    let enhanced = enhancedFull;
    if (isVideo) {
      shotPlan = await planShotSequenceAsync(prompt, {
        previousState: null,
      });
      if (!shotPlan.multiShot || shotPlan.shotCount < 2) {
        const fromCore = await planShotSequenceAsync(result.coreIdea || prompt, {
          previousState: null,
        });
        if (fromCore.multiShot && fromCore.shotCount >= 2) {
          shotPlan = fromCore;
        }
      }
      if (shotPlan.multiShot && shotPlan.shotCount >= 2) {
        const entities = result.finalState?.entities || [];
        const genders = result.finalState?.entityGenders;
        // Per-shot: keep the user's action beat, inject vision entities, then
        // AI-polish THAT beat for generation (filter/cinematic quality).
        shots = shotPlan.shots.map((s, index) => {
          const grounded =
            entities.length > 0
              ? injectEntitiesIntoAction(s.action, entities, arabic, genders)
              : s.action;
          const polished = enhancePrompt(grounded, String(mode));
          const oneShotLock = arabic
            ? "لقطة واحدة فقط، نفّذ هذا الفعل دون إضافة أحداث من لقطات أخرى"
            : "one shot only, perform this action without adding events from other shots";
          const promptOut = polished
            ? `${polished}. ${oneShotLock}`
            : s.prompt;
          return {
            index,
            // Script shows the clear action (+ entities), not a dense blob.
            action: extractCoreIdea(polished) || grounded,
            prompt: promptOut,
          };
        });
        enhanced = formatShotScript({ ...shotPlan, shots }, arabic);
        const setting = (result.coreIdea || "").match(
          /المكان كما في الصورة:[^.]+|Setting matches the reference image:[^.]+/i,
        );
        if (setting) {
          enhanced = `${enhanced}\n\n${setting[0].trim()}.`;
        }
      }
    }

    return NextResponse.json({
      original: prompt,
      enhanced,
      enhancedFull,
      coreIdea: result.coreIdea,
      finalState: result.finalState,
      visionUsed: result.visionUsed,
      needsVisionKey: result.needsVisionKey,
      chained: result.chained,
      entityBrief: result.entityBrief,
      multiShot: Boolean(shotPlan?.multiShot && (shotPlan?.shotCount || 0) >= 2),
      shotCount: shotPlan?.shotCount || 1,
      shotReason: shotPlan?.reason || null,
      shots,
      variants: [
        enhanced,
        enhancePromptVariant(result.coreIdea || prompt, String(mode), "Emphasize mood and texture"),
        enhancePromptVariant(
          result.coreIdea || prompt,
          String(mode),
          "Emphasize motion and action",
        ),
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enhance failed" },
      { status: 500 },
    );
  }
}
