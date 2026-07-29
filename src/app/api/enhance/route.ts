import { NextResponse } from "next/server";
import {
  enhancePrompt,
  enhancePromptVariant,
  enhancePromptWithContext,
  type SceneState,
} from "@/lib/prompt-enhance";
import {
  enhanceToCinematic,
  hasArabic,
  isMostlyArabic,
  isMostlyEnglish,
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
 * 2) AI cinematic polish in the customer's language (Arabic stays Arabic)
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
    const preferArabic = isMostlyArabic(prompt) || hasArabic(prompt);

    // Vision / context grounding (keeps Arabic core when the customer wrote Arabic).
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
          arabic: preferArabic,
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

    const cinematic = await withTimeout(
      enhanceToCinematic(sourceForPolish, {
        entities: result.finalState?.entities,
        setting: result.finalState?.setting,
        media: isVideo ? "video" : "image",
      }),
      28_000,
      {
        prompt: "",
        language: preferArabic ? ("ar" as const) : ("en" as const),
        translated: false,
        providerOk: false,
      },
    );

    let enhanced = (cinematic.prompt || "").trim();
    let language = cinematic.language;

    // Fallback: local Arabic/English template enhance from grounded idea.
    if (!enhanced || (preferArabic && !hasArabic(enhanced))) {
      const local = (result.enhanced || enhancePrompt(sourceForPolish, String(mode))).trim();
      if (local) {
        enhanced = local;
        language = hasArabic(local) ? "ar" : "en";
      }
    }

    if (!enhanced) {
      return NextResponse.json(
        { error: "لم يتم إنشاء وصف محسّن — أعد المحاولة" },
        { status: 502 },
      );
    }

    // English-only sources must stay English; Arabic sources must stay Arabic.
    if (preferArabic && !hasArabic(enhanced)) {
      const local = (result.enhanced || sourceForPolish).trim();
      if (hasArabic(local)) {
        enhanced = local;
        language = "ar";
      } else {
        return NextResponse.json(
          {
            error:
              "تعذر تحسين الوصف بالعربية. تأكد من تفعيل مفتاح Gemini أو OpenAI على السيرفر ثم أعد المحاولة.",
          },
          { status: 503 },
        );
      }
    }

    if (!preferArabic && !isMostlyEnglish(enhanced) && !hasArabic(enhanced)) {
      // Keep whatever we have if neither detector matches (numbers/symbols).
    }

    return NextResponse.json({
      original: prompt,
      english: language === "en" ? enhanced : undefined,
      arabic: language === "ar" ? enhanced : undefined,
      enhanced,
      enhancedFull: result.enhanced || enhanced,
      coreIdea: result.coreIdea,
      finalState: {
        ...result.finalState,
        arabic: language === "ar" || Boolean(result.finalState?.arabic),
      },
      visionUsed: result.visionUsed,
      needsVisionKey: result.needsVisionKey,
      chained: result.chained,
      entityBrief: result.entityBrief,
      translated: language === "en" && preferArabic,
      language,
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
          language === "ar"
            ? "مع تركيز أقوى على المزاج والملمس البصري"
            : "Emphasize mood and texture",
        ),
        enhancePromptVariant(
          enhanced,
          String(mode),
          language === "ar"
            ? "مع تركيز أقوى على فيزياء الحركة والتفاصيل الثانوية"
            : "Emphasize motion and action",
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
