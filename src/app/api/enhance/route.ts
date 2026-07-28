import { NextResponse } from "next/server";
import {
  enhancePrompt,
  enhancePromptVariant,
  enhancePromptWithContext,
  type SceneState,
} from "@/lib/prompt-enhance";
import {
  enhanceToEnglishCinematic,
  isMostlyEnglish,
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
 * Improve Description:
 * 1) Optional vision grounding from refs
 * 2) Translate + AI cinematic polish → English only
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
          .filter((u) => !(u.startsWith("data:") && u.length > 400_000))
          .slice(0, 2)
      : [];

    const isVideo = String(mode).includes("video");

    // Vision / context grounding (may keep Arabic coreIdea briefly).
    const result = await withTimeout(
      enhancePromptWithContext(prompt, String(mode), {
        imageUrls,
        previousState: body.previousState || null,
        forceChain: Boolean(body.forceChain),
      }),
      20_000,
      {
        enhanced: enhancePrompt(prompt, String(mode)),
        finalState: {
          arabic: /[\u0600-\u06FF]/.test(prompt),
          entities: [],
          finalPose: "",
          lastAction: prompt,
          updatedAt: new Date().toISOString(),
        },
        visionUsed: false,
        needsVisionKey: false,
        chained: false,
        entityBrief: "",
        coreIdea: prompt,
      },
    );

    const sourceForPolish = (result.coreIdea || prompt).trim();

    // Translate + AI enhance into one English cinematic prompt.
    const cinematic = await withTimeout(
      enhanceToEnglishCinematic(sourceForPolish, {
        entities: result.finalState?.entities,
        setting: result.finalState?.setting,
        media: isVideo ? "video" : "image",
      }),
      28_000,
      {
        prompt: "",
        translated: false,
        providerOk: false,
      },
    );

    let enhanced = (cinematic.prompt || "").trim();

    // Hard guarantee: if still not English, force translate then polish again.
    if (!enhanced || !isMostlyEnglish(enhanced)) {
      const englishSource = await withTimeout(
        translatePromptToEnglish(sourceForPolish),
        14_000,
        sourceForPolish,
      );
      const retry = await withTimeout(
        enhanceToEnglishCinematic(englishSource, {
          entities: result.finalState?.entities,
          setting: result.finalState?.setting,
          media: isVideo ? "video" : "image",
        }),
        20_000,
        { prompt: englishSource, translated: false, providerOk: false },
      );
      enhanced = (retry.prompt || englishSource || sourceForPolish).trim();
    }

    if (!enhanced) {
      return NextResponse.json(
        { error: "لم يتم إنشاء وصف محسّن — أعد المحاولة" },
        { status: 502 },
      );
    }

    if (!isMostlyEnglish(enhanced)) {
      return NextResponse.json(
        {
          error:
            "تعذر ترجمة الوصف إلى الإنجليزية. تأكد من تفعيل مفتاح Gemini أو OpenAI على السيرفر ثم أعد المحاولة.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      original: prompt,
      english: enhanced,
      enhanced,
      enhancedFull: result.enhanced || enhanced,
      coreIdea: result.coreIdea,
      finalState: result.finalState,
      visionUsed: result.visionUsed,
      needsVisionKey: result.needsVisionKey,
      chained: result.chained,
      entityBrief: result.entityBrief,
      translated: true,
      multiShot: false,
      shotCount: 1,
      shotReason: null,
      shots: [
        {
          index: 0,
          action: result.coreIdea || prompt,
          prompt: enhanced,
        },
      ],
      variants: [
        enhanced,
        enhancePromptVariant(
          enhanced,
          String(mode),
          "Emphasize mood and texture",
        ),
        enhancePromptVariant(
          enhanced,
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
