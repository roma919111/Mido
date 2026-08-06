import { NextResponse } from "next/server";
import { translateDialogueToArabic } from "@/lib/dialogue-translate";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { text?: string };

/** Translate dialogue/subtitle text to Arabic for Editing Studio. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    const result = await translateDialogueToArabic(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
