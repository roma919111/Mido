import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { quoteOpenArtCredits } from "@/lib/credit-quote";
import { isFreeVeronixEligible } from "@/lib/free-trial";
import { planShotSequenceAsync, shouldAutoMultiShot } from "@/lib/shot-plan";
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

    const freeTrial = Boolean(
      user &&
        body.modelId &&
        isFreeVeronixEligible(user, {
          modelId: body.modelId,
          media,
          duration: body.duration,
        }),
    );

    const wantMulti = body.multiShot !== false;
    const perShotSeconds = Math.min(5, Math.max(4, Number(body.duration) || 5));

    const plan = await planShotSequenceAsync(prompt, {
      perShotSeconds,
      forceSingle: !wantMulti || freeTrial || media !== "video",
      previousState: body.previousState || null,
    });

    const auto = shouldAutoMultiShot(plan, { freeTrial, media });

    let unitCredits: number | null = null;
    let totalCredits: number | null = null;
    let available = true;

    if (body.modelId && media === "video") {
      // Shot 1 may be t2v or i2v; shots 2+ are image2video — quote image2video as baseline for N.
      const mode = "image2video";
      const quote = await quoteOpenArtCredits(
        {
          modelId: body.modelId,
          media: "video",
          mode,
          aspectRatio: body.aspectRatio || "16:9",
          resolution: body.resolution,
          duration: plan.perShotSeconds,
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
      perShotSeconds: plan.perShotSeconds,
      shotCount: plan.shotCount,
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
