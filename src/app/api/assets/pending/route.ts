import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { createAsset, updateAsset } from "@/lib/db";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
  shotCount?: number;
  /** Final stitched length in seconds (for ETA countdown) */
  targetSeconds?: number;
  /** Update an existing pending/job asset instead of creating */
  assetId?: string;
  url?: string;
  status?: "running" | "completed" | "failed";
  error?: string;
  historyId?: string;
  mode?: string;
};

/**
 * Visible multi-shot job card in Assets while hidden beats generate + stitch.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const prompt = (body.prompt || "").trim() || "مشهد متعدد اللقطات";

    if (body.assetId?.trim()) {
      const patch: Record<string, unknown> = {
        hidden: false,
      };
      if (typeof body.url === "string") patch.url = body.url;
      if (body.status) patch.status = body.status;
      if (body.error !== undefined) patch.error = body.error || undefined;
      if (body.historyId !== undefined) patch.historyId = body.historyId || undefined;
      if (body.mode) patch.mode = body.mode;
      const updated = await updateAsset(body.assetId.trim(), user.id, patch);
      if (!updated) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      return NextResponse.json({ asset: updated });
    }

    const shotCount =
      typeof body.shotCount === "number" && body.shotCount > 0
        ? Math.min(16, Math.round(body.shotCount))
        : 0;
    const targetSeconds =
      typeof body.targetSeconds === "number" && body.targetSeconds > 0
        ? Math.round(body.targetSeconds)
        : shotCount > 0
          ? shotCount * 4
          : 4;
    const asset = await createAsset({
      userId: user.id,
      mediaType: "video",
      url: "",
      prompt: shotCount
        ? `${prompt}\n\n(جارٍ توليد ودمج ${shotCount} لقطات…)`
        : prompt,
      mode: "sequence-pending",
      model: VERONIX_MODEL_ID,
      creditsUsed: 0,
      status: "running",
      hidden: false,
      targetSeconds,
    });
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "pending asset failed" },
      { status: 500 },
    );
  }
}
