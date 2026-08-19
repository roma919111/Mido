import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { findAssetById, findUserById, setAssetPublished } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as { assetId?: string; publish?: boolean };
    const assetId = body.assetId?.trim();
    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const asset = await findAssetById(user.id, assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (asset.status !== "completed" || asset.mediaType !== "video") {
      return NextResponse.json({ error: "Only completed videos can be published" }, { status: 409 });
    }

    const publish = body.publish !== false;
    const updated = await setAssetPublished(user.id, assetId, publish);
    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 422 });
    }

    const author = await findUserById(user.id);
    return NextResponse.json({
      ok: true,
      assetId: updated.id,
      publishedAt: updated.publishedAt || null,
      authorName: author?.name || user.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed" },
      { status: 422 },
    );
  }
}
