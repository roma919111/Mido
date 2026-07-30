import { NextResponse } from "next/server";
import { isBytePlusConfigured } from "@/lib/byteplus-ark";
import { applyGbAigcLabeling } from "@/lib/gb-aigc-label";
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

    const raw = Buffer.from(await file.arrayBuffer());
    if (raw.byteLength < 32) {
      return NextResponse.json({ error: "Image file is empty" }, { status: 400 });
    }

    // GB 45438-2025 / CAC: explicit corner mark + AIGC EXIF/XMP, re-export JPEG
    // so Chinese scanners (Seedance) can treat the still as Confirmed AI Content.
    let bytes: Buffer = raw;
    let contentType = file.type || "image/png";
    let aigcLabeled = false;
    try {
      bytes = await applyGbAigcLabeling(raw);
      contentType = "image/jpeg";
      aigcLabeled = true;
    } catch (err) {
      console.warn(
        "[veronix] upload GB AIGC labeling failed, storing original:",
        err instanceof Error ? err.message : err,
      );
    }

    const { localPath, visualReference } = await saveLocalImage({
      bytes,
      contentType,
      label: file.name || label,
      prefix: "ref",
    });

    return NextResponse.json({
      visualReference,
      accessURL: localPath,
      live: true,
      provider: "local",
      byteplusConfigured: isBytePlusConfigured(),
      aigcLabeled,
      aigcStandard: aigcLabeled ? "GB45438-2025" : null,
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
