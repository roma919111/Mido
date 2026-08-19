/**
 * Shared FFmpeg filter strings for Edit Studio export (client + server).
 */

import type { EditStudioAspect, EditStudioFilter } from "@/lib/edit-studio-draft";
import {
  aspectFfmpegScale,
  ffmpegEncodeFlags,
  type EditStudioExportQuality,
} from "@/lib/edit-studio-export-quality";

export const FILTER_FFMPEG: Record<EditStudioFilter, string> = {
  none: "",
  cinematic: "eq=contrast=1.12:brightness=-0.04:saturation=1.18",
  vintage: "colorbalance=rs=0.25:gs=0.05:bs=-0.15,eq=saturation=0.82",
  contrast: "eq=contrast=1.38:saturation=1.05",
  bw: "hue=s=0",
};

/** Constant frame rate fallback when source fps cannot be probed. */
export const EXPORT_OUTPUT_FPS = 30;

export function parseProbeFps(rFrameRate: string | undefined): number {
  if (!rFrameRate || rFrameRate === "0/0") return EXPORT_OUTPUT_FPS;
  const [nRaw, dRaw] = rFrameRate.split("/");
  const n = Number(nRaw);
  const d = Number(dRaw);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return EXPORT_OUTPUT_FPS;
  const fps = n / d;
  if (fps < 15) return 24;
  if (fps > 60) return 30;
  return Math.round(fps);
}

export function aspectRatioMatches(
  width: number,
  height: number,
  aspect: EditStudioAspect,
  tolerance = 0.06,
): boolean {
  if (width <= 0 || height <= 0) return false;
  const r = width / height;
  const targets: Record<EditStudioAspect, number> = {
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "1:1": 1,
  };
  return Math.abs(r - targets[aspect]) <= tolerance;
}

export function clipNeedsVideoReencode(clip: {
  filter: EditStudioFilter;
  exportAspect: EditStudioAspect;
}): boolean {
  return clip.filter !== "none";
}

export function vfForClipExport(
  filter: EditStudioFilter,
  aspect: EditStudioAspect,
  quality: EditStudioExportQuality,
  outputFps?: number,
): string {
  const parts: string[] = [];
  const ff = FILTER_FFMPEG[filter];
  if (ff) parts.push(ff);
  parts.push(aspectFfmpegScale(aspect, quality));
  parts.push("setsar=1");
  const fps = outputFps && outputFps > 0 ? outputFps : EXPORT_OUTPUT_FPS;
  parts.push(`fps=${fps}`, "format=yuv420p");
  return parts.filter(Boolean).join(",");
}

export function encodeVideoArgs(quality: EditStudioExportQuality): string[] {
  const { preset, crf } = ffmpegEncodeFlags(quality);
  return [
    "-c:v",
    "libx264",
    "-preset",
    preset,
    "-crf",
    String(crf),
    "-pix_fmt",
    "yuv420p",
  ];
}

export function encodeAudioArgs(quality: EditStudioExportQuality): string[] {
  const { audioBitrate } = ffmpegEncodeFlags(quality);
  return ["-c:a", "aac", "-b:a", audioBitrate, "-ar", "44100", "-ac", "2"];
}

/** Stereo resample before AAC — keeps A/V in sync after video re-encode. */
export function encodeAudioFilterArgs(): string[] {
  return ["-af", "aformat=sample_rates=44100:channel_layouts=stereo"];
}
