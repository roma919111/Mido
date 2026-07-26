import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import { isFreeVeronixEligible } from "@/lib/free-trial";
import { durationBoundsForModel, getCatalogModel } from "@/lib/model-catalog";
import {
  planShotSequenceAsync,
  recommendShotTiming,
  shouldAutoMultiShot,
} from "@/lib/shot-plan";
import type { SceneState } from "@/lib/prompt-chain";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
  modelId?: string;
  media?: "image" | "video";
  duration?: number;
  resolution?: string;
  generateAudio?: boolean;
  aspectRatio?: string;
  previousState?: SceneState | null;
  /** User toggle — default true for video */
  multiShot?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as Body;
    const prompt = body.prompt?.trim() || "";
    const media = body.media ?? "video";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const wantMulti = body.multiShot !== false;
    // Free trial is single-clip only. Planning with multiShot:true is always paid,
    // even though each Seedance beat is 4s (same number as the free trial length).
    const freeTrial = Boolean(
      user &&
        body.modelId &&
        isFreeVeronixEligible(user, {
          modelId: body.modelId,
          media,
          duration: body.duration,
          multiShot: wantMulti,
        }),
    );
    const catalog = body.modelId ? getCatalogModel(body.modelId) : null;
    const bounds = durationBoundsForModel(catalog);

    // Draft plan first to know shot count, then apply timing recommendation.
    const draft = await planShotSequenceAsync(prompt, {
      perShotSeconds: bounds.min,
      forceSingle: !wantMulti || freeTrial || media !== "video",
      previousState: body.previousState || null,
    });

    const timing = recommendShotTiming(draft.shotCount, bounds.min, bounds.max);
    const plan = await planShotSequenceAsync(prompt, {
      perShotSeconds: timing.perShotSeconds,
      forceSingle: !wantMulti || freeTrial || media !== "video",
      previousState: body.previousState || null,
    });

    const auto = shouldAutoMultiShot(plan, { freeTrial, media });

    let unitCredits: number | null = null;
    let totalCredits: number | null = null;
    let available = true;

    if (body.modelId && media === "video") {
      const mode = "image2video";
      const quote = await quoteOpenArtCredits(
        {
          modelId: body.modelId,
          media: "video",
          mode,
          aspectRatio: body.aspectRatio || "16:9",
          resolution: body.resolution,
          // Bill for what OpenArt actually renders (model min may be > product 2s).
          duration: timing.apiPerShotSeconds,
          generateAudio: body.generateAudio,
        },
        { allowCache: true },
      );
      available = quote.available;
      unitCredits = quote.totalCredits;
      totalCredits = auto ? quote.totalCredits * plan.shotCount : quote.totalCredits;
      if (freeTrial) {
        unitCredits = 0;
        totalCredits = 0;
      }
    }

    return NextResponse.json({
      plan,
      autoMultiShot: auto,
      freeTrial,
      perShotSeconds: timing.perShotSeconds,
      totalSeconds: timing.totalSeconds,
      shotCount: plan.shotCount,
      timing,
      unitCredits,
      totalCredits,
      available,
      actions: plan.shots.map((s) => s.action),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Shot plan failed" },
      { status: 500 },
    );
  }
}
