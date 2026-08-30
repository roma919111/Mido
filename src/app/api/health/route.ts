import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import path from "node:path";
import { isBytePlusConfigured } from "@/lib/byteplus-ark";
import { isSeedance2Configured } from "@/lib/byteplus-constants";
import { isPixVerseConfigured } from "@/lib/pixverse";
import { isGeminiVideoConfigured } from "@/lib/gemini-video";
import { isMiniMaxVideoConfigured } from "@/lib/minimax-video";
import { isKlingVideoConfigured } from "@/lib/kling-video";
import { isFluxVideoConfigured } from "@/lib/flux-video";
import { ffmpegAvailable } from "@/lib/iptv-hls-ffmpeg";
import { getVyronixSurface } from "@/lib/vyronix-surface";
import { DEPLOY_BUILD } from "@/lib/deploy-version";

export const runtime = "nodejs";

/** Lightweight liveness probe for Railway healthchecks. */
export async function GET() {
  const dataDir = path.join(process.cwd(), ".data");
  let dataDirOk = false;
  try {
    await access(dataDir);
    dataDirOk = true;
  } catch {
    dataDirOk = false;
  }

  return NextResponse.json({
    ok: true,
    service: "vyronix",
    surface: getVyronixSurface(),
    build: DEPLOY_BUILD,
    dataDirOk,
    ffmpeg: ffmpegAvailable(),
    providers: {
      byteplus: isBytePlusConfigured(),
      seedance2: isSeedance2Configured(),
      pixverse: isPixVerseConfigured(),
      gemini: isGeminiVideoConfigured(),
      minimax: isMiniMaxVideoConfigured(),
      kling: isKlingVideoConfigured(),
      flux: isFluxVideoConfigured(),
    },
    ts: new Date().toISOString(),
  });
}
