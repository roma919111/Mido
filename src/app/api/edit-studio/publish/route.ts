import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { createAsset, findUserById } from "@/lib/db";
import { saveLocalVideo } from "@/lib/local-media";

export const runtime = "nodejs";

const MAX_PUBLISH_BYTES = 120 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const prompt = String(form.get("prompt") ?? "").trim();
    const aspectRatio = String(form.get("aspectRatio") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength < 1000) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (bytes.byteLength > MAX_PUBLISH_BYTES) {
      return NextResponse.json({ error: "Video is too large (max 120 MB)" }, { status: 400 });
    }

    const { localPath } = await saveLocalVideo({
      bytes,
      contentType: file.type || "video/mp4",
      label: user.id.slice(0, 8),
      prefix: "edit-pub",
    });

    const now = new Date().toISOString();
    const asset = await createAsset({
      userId: user.id,
      mediaType: "video",
      url: localPath,
      prompt: prompt || "مقطع من استوديو الإيديتينج",
      mode: "edit-export",
      model: "edit-studio",
      creditsUsed: 0,
      status: "completed",
      hidden: false,
      aspectRatio: aspectRatio || "16:9",
      completedAt: now,
      publishedAt: now,
    });

    const author = await findUserById(user.id);

    return NextResponse.json({
      ok: true,
      assetId: asset.id,
      publishedAt: asset.publishedAt,
      authorName: author?.name || user.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed" },
      { status: 500 },
    );
  }
}
