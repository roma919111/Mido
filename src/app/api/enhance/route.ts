import { NextResponse } from "next/server";
import {
  enhancePrompt,
  enhancePromptVariant,
  enhancePromptWithContext,
  type SceneState,
} from "@/lib/prompt-enhance";
import type { GenerationMode } from "@/lib/types";

export const runtime = "nodejs";

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

    const enhanced = result.enhanced || enhancePrompt(prompt, String(mode));

    return NextResponse.json({
      original: prompt,
      enhanced,
      coreIdea: result.coreIdea,
      finalState: result.finalState,
      visionUsed: result.visionUsed,
      chained: result.chained,
      entityBrief: result.entityBrief,
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
