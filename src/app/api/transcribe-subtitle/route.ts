import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  extractClipAudioFromSource,
  resolveClipVideoSource,
} from "@/lib/extract-clip-audio-server";
import { transcribeClipDialogue, type TranscribeMode } from "@/lib/transcribe-subtitle";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  audioBase64?: string;
  mimeType?: string;
  videoUrl?: string;
  historyId?: string;
  trimStart?: number;
  clipDurationSec?: number;
  characterName?: string;
  mode?: TranscribeMode;
  characterVoiceIndex?: number;
};

/** Transcribe clip audio → timed Arabic cues (server ffmpeg + Gemini). */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const mode: TranscribeMode =
      body.mode === "all" ? "all" : body.characterName?.trim() ? "character" : "all";

    if (mode === "character" && !body.characterName?.trim()) {
      return NextResponse.json({ error: "Character name is required" }, { status: 400 });
    }

    const clipDurationSec =
      typeof body.clipDurationSec === "number" && body.clipDurationSec > 0
        ? body.clipDurationSec
        : 0;
    const trimStart =
      typeof body.trimStart === "number" && body.trimStart >= 0 ? body.trimStart : 0;

    let audioBase64 = body.audioBase64?.trim() ?? "";
    let mimeType = body.mimeType?.trim() || "audio/wav";

    if (!audioBase64) {
      const sourceUrl = await resolveClipVideoSource({
        videoUrl: body.videoUrl,
        historyId: body.historyId,
      });
      if (!sourceUrl) {
        return NextResponse.json(
          { error: "تعذّر الوصول للفيديو — أعد إرسال المقطع من الأصول", cues: [], text: "" },
          { status: 422 },
        );
      }

      const playDur = clipDurationSec > 0 ? clipDurationSec : 60;
      const audio = await extractClipAudioFromSource(sourceUrl, trimStart, playDur);
      if (!audio?.buffer.length) {
        return NextResponse.json(
          {
            error: "no_audio",
            cues: [],
            text: "",
          },
          { status: 422 },
        );
      }
      audioBase64 = audio.buffer.toString("base64");
      mimeType = audio.mimeType;
    }

    const result = await transcribeClipDialogue({
      audioBase64,
      mimeType,
      clipDurationSec: clipDurationSec || undefined,
      mode,
      characterName: body.characterName?.trim(),
      characterVoiceIndex:
        typeof body.characterVoiceIndex === "number"
          ? body.characterVoiceIndex
          : undefined,
    });

    if (result.error && !result.cues.length) {
      return NextResponse.json(
        { error: result.error, cues: [], text: "" },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 },
    );
  }
}
