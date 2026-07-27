import { NextResponse } from "next/server";
import {
  enhancePrompt,
  enhancePromptVariant,
  enhancePromptWithContext,
  type SceneState,
} from "@/lib/prompt-enhance";
import { injectEntitiesIntoAction } from "@/lib/prompt-chain";
import {
  polishShotPromptEnglish,
  translatePromptToEnglish,
} from "@/lib/prompt-translate";
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

    const isVideo = String(mode).includes("video");

    // Video enhance: always translate → English, then one AI-polished shot per action.
    const englishSource = isVideo
      ? await translatePromptToEnglish(prompt)
      : prompt;

    const result = await enhancePromptWithContext(englishSource, String(mode), {
      imageUrls,
      previousState: body.previousState || null,
      forceChain: Boolean(body.forceChain),
    });

    const enhancedFull =
      result.enhanced || enhancePrompt(englishSource, String(mode));
    // Shot script / generation prompts are English for video.
    const arabic = isVideo ? false : /[\u0600-\u06FF]/.test(result.coreIdea || prompt);

    let shotPlan = null as Awaited<ReturnType<typeof planShotSequenceAsync>> | null;
    let shots: PlannedShot[] = [];
    let enhanced = enhancedFull;

    if (isVideo) {
      // Plan beats from the English translation so each action → one shot.
      shotPlan = await planShotSequenceAsync(englishSource, {
        previousState: null,
      });
      if (!shotPlan.multiShot || shotPlan.shotCount < 2) {
        const fromCore = await planShotSequenceAsync(
          result.coreIdea || englishSource,
          { previousState: null },
        );
        if (fromCore.multiShot && fromCore.shotCount >= 2) {
          shotPlan = fromCore;
        }
      }

      if (shotPlan.multiShot && shotPlan.shotCount >= 2) {
        const entities = result.finalState?.entities || [];
        const genders = result.finalState?.entityGenders;
        const setting = result.finalState?.setting;

        shots = [];
        for (let index = 0; index < shotPlan.shots.length; index += 1) {
          const s = shotPlan.shots[index]!;
          const grounded =
            entities.length > 0
              ? injectEntitiesIntoAction(s.action, entities, false, genders)
              : s.action;
          const polished = await polishShotPromptEnglish(grounded, {
            entities,
            setting,
          });
          const oneShotLock =
            "one shot only, perform this action without adding events from other shots";
          const promptOut = polished
            ? `${polished} ${oneShotLock}`
            : `${enhancePrompt(grounded, String(mode))}. ${oneShotLock}`;
          shots.push({
            index,
            action: grounded,
            prompt: promptOut,
          });
        }

        enhanced = formatShotScript({ ...shotPlan, shots }, false);
        if (setting) {
          enhanced = `${enhanced}\n\nSetting: ${setting}.`;
        }
      } else {
        // Single-action: still English AI-polished description.
        const polished = await polishShotPromptEnglish(
          result.coreIdea || englishSource,
          {
            entities: result.finalState?.entities,
            setting: result.finalState?.setting,
          },
        );
        enhanced = polished || enhancedFull;
        shots = [
          {
            index: 0,
            action: result.coreIdea || englishSource,
            prompt: enhanced,
          },
        ];
      }
    }

    return NextResponse.json({
      original: prompt,
      english: isVideo ? englishSource : undefined,
      enhanced,
      enhancedFull,
      coreIdea: result.coreIdea,
      finalState: result.finalState,
      visionUsed: result.visionUsed,
      needsVisionKey: result.needsVisionKey,
      chained: result.chained,
      entityBrief: result.entityBrief,
      multiShot: Boolean(shotPlan?.multiShot && (shotPlan?.shotCount || 0) >= 2),
      shotCount: shotPlan?.shotCount || shots.length || 1,
      shotReason: shotPlan?.reason || null,
      shots,
      variants: [
        enhanced,
        enhancePromptVariant(
          result.coreIdea || englishSource,
          String(mode),
          "Emphasize mood and texture",
        ),
        enhancePromptVariant(
          result.coreIdea || englishSource,
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
