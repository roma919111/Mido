import { NextResponse } from "next/server";
import { GeminiConfigError, isGeminiConfigured } from "@/lib/gemini-client";
import { saveUploadedImage } from "@/lib/local-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 401 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const label = String(form.get("label") ?? "upload");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }

    const reference = await saveUploadedImage(file, label);

    return NextResponse.json({
      visualReference: reference,
      accessURL: reference.url,
      live: true,
      provider: "gemini",
    });
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
        provider: "gemini",
      },
      { status: 500 },
    );
  }
}
