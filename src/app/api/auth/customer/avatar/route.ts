import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/customer-auth";
import { updateUser } from "@/lib/db";
import { saveLocalImage } from "@/lib/local-media";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength < 32) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (bytes.byteLength > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 2 MB)" }, { status: 400 });
    }

    const { localPath } = await saveLocalImage({
      bytes,
      contentType: file.type || "image/jpeg",
      label: user.id.slice(0, 8),
      prefix: "avatar",
    });

    const updated = await updateUser(user.id, { avatarUrl: localPath });
    return NextResponse.json({ user: publicUser(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
