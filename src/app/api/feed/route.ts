import { NextResponse } from "next/server";
import { findUserById, listPublishedAssets } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") || "16");
    const limit = Number.isFinite(limitRaw) ? Math.min(48, Math.max(1, limitRaw)) : 16;

    const assets = await listPublishedAssets(limit);
    const items = await Promise.all(
      assets.map(async (asset) => {
        const author = await findUserById(asset.userId);
        return {
          id: asset.id,
          prompt: asset.prompt,
          aspectRatio: asset.aspectRatio || "16:9",
          publishedAt: asset.publishedAt,
          authorName: author?.name || "Creator",
          authorAvatarUrl: author?.avatarUrl || null,
        };
      }),
    );

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feed failed" },
      { status: 422 },
    );
  }
}
