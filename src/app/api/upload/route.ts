import { NextResponse } from "next/server";
import { isBytePlusConfigured } from "@/lib/byteplus-ark";
import { saveLocalImage } from "@/lib/local-media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const label = String(form.get("label") ?? "upload");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength < 32) {
      return NextResponse.json({ error: "Image file is empty" }, { status: 400 });
    }

    const { localPath, visualReference } = await saveLocalImage({
      bytes,
      contentType: file.type || "image/png",
      label: file.name || label,
      prefix: "ref",
    });

    return NextResponse.json({
      visualReference,
      accessURL: localPath,
      live: true,
      provider: "local",
      byteplusConfigured: isBytePlusConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
        provider: "local",
      },
      { status: 500 },
    );
  }
}
