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
export const maxDuration = 60;

type EnhanceBody = {
  prompt?: string;
  mode?: GenerationMode | string;
  imageUrls?: string[];
  previousState?: SceneState | null;
  forceChain?: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

/**
 * Familiar enhance flow:
 * 1) Translate speech/prompt → English
 * 2) Optional vision grounding from refs
 * 3) AI Polish into one cinematic English description
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
      ? body.imageUrls
          .filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
          // Skip huge data URLs — they hang vision and mobile clients.
          .filter((u) => !(u.startsWith("data:") && u.length > 400_000))
          .slice(0, 2)
      : [];

    const isVideo = String(mode).includes("video");

    // Step 1 — translate to English (image + video). Soft timeout.
    const englishSource = await withTimeout(
      translatePromptToEnglish(prompt),
      12_000,
      prompt,
    );

    const result = await withTimeout(
      enhancePromptWithContext(englishSource, String(mode), {
        imageUrls,
        previousState: body.previousState || null,
        forceChain: Boolean(body.forceChain),
      }),
      20_000,
      {
        enhanced: enhancePrompt(englishSource, String(mode)),
        finalState: {
          arabic: /[\u0600-\u06FF]/.test(prompt),
          entities: [],
          finalPose: "",
          lastAction: englishSource,
          updatedAt: new Date().toISOString(),
        },
        visionUsed: false,
        needsVisionKey: false,
        chained: false,
        entityBrief: "",
        coreIdea: englishSource,
      },
    );

    const enhancedFull =
      result.enhanced || enhancePrompt(englishSource, String(mode));

    // Step 2 — AI Polish into one customer-facing English prompt.
    const polished = await withTimeout(
      polishPromptEnglish(result.coreIdea || englishSource, {
        entities: result.finalState?.entities,
        setting: result.finalState?.setting,
        media: isVideo ? "video" : "image",
      }),
      15_000,
      "",
    );
    const enhanced = (polished || enhancedFull).trim();

    return NextResponse.json({
      original: prompt,
      english: englishSource,
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
