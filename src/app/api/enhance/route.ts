import { NextResponse } from "next/server";
import {
  enhancePrompt,
  enhancePromptVariant,
  enhancePromptWithContext,
  type SceneState,
} from "@/lib/prompt-enhance";
import {
  polishPromptEnglish,
  translatePromptToEnglish,
} from "@/lib/prompt-translate";
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

/**
 * Familiar enhance flow:
 * 1) Translate speech/prompt → English
 * 2) AI Polish into one cinematic English description
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnhanceBody;
    const prompt = body.prompt?.trim() ?? "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const mode = body.mode ?? "text-to-image";
    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter(
          (u): u is string => typeof u === "string" && Boolean(u.trim()),
        )
      : [];

    const isVideo = String(mode).includes("video");

    // Step 1 — translate to English (video).
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

    let enhanced = enhancedFull;

    if (isVideo) {
      // Step 2 — AI Polish the English scene into one customer-facing prompt.
      const polished = await polishPromptEnglish(
        result.coreIdea || englishSource,
        {
          entities: result.finalState?.entities,
          setting: result.finalState?.setting,
        },
      );
      enhanced = polished || enhancedFull;
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
      multiShot: false,
      shotCount: 1,
      shotReason: null,
      shots: [
        {
          index: 0,
          action: result.coreIdea || englishSource,
          prompt: enhanced,
        },
      ],
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
