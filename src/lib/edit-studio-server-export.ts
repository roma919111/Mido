/**
 * Server-side Edit Studio export — stable high quality with native ffmpeg (Railway).
 */

import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EditStudioExportQuality } from "@/lib/edit-studio-export-quality";
import {
  aspectRatioMatches,
  clipNeedsVideoReencode,
  encodeAudioArgs,
  encodeAudioFilterArgs,
  encodeVideoArgs,
  parseProbeFps,
  vfForClipExport,
} from "@/lib/edit-studio-export-constants";
import { resolveClipPlayRange } from "@/lib/edit-studio-dialogue";
import { resolveHistoryVideoUrl } from "@/lib/resolve-history-url";
import { serverFfmpegEnabled } from "@/lib/server-load-policy";
import type { TimelineClip } from "@/lib/edit-studio-timeline";
import { resolveGenerationFile } from "@/lib/veronix-outro";

type VideoProbe = {
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
};

function runFfmpeg(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
    });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-1500) || `ffmpeg failed (${code})`));
    });
  });
}

async function probeVideoFile(filePath: string): Promise<VideoProbe> {
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,width,height,r_frame_rate",
        "-of",
        "json",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || "ffprobe failed"));
    });
  });

  const parsed = JSON.parse(out) as {
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }>;
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const hasAudio = streams.some((s) => s.codec_type === "audio");

  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: parseProbeFps(video?.r_frame_rate),
    hasAudio,
  };
}

async function downloadSource(url: string, dest: string) {
  if (url.startsWith("/generations/")) {
    const src = resolveGenerationFile(url);
    if (!src) throw new Error("Invalid generation path");
    await copyFile(src, dest);
    return;
  }
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "video/mp4,video/*,*/*",
      "User-Agent": "VyronixEditExport/1.0 (+https://vyronix.app)",
      Referer: "https://vyronix.app/",
    },
  });
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error("Download returned empty video");
  await writeFile(dest, buf);
}

async function resolveClipSourceUrl(clip: TimelineClip): Promise<string> {
  if (clip.historyId?.trim()) {
    const url = await resolveHistoryVideoUrl(clip.historyId.trim());
    if (url) return url;
  }
  try {
    const parsed = new URL(clip.videoUrl, "https://vyronix.app");
    const hid = parsed.searchParams.get("historyId")?.trim();
    if (hid) {
      const url = await resolveHistoryVideoUrl(hid);
      if (url) return url;
    }
    const encoded = parsed.searchParams.get("u")?.trim();
    if (encoded) return Buffer.from(encoded, "base64url").toString("utf8");
    if (parsed.pathname.startsWith("/generations/")) return parsed.pathname;
  } catch {
    // fall through
  }
  if (clip.videoUrl.startsWith("http://") || clip.videoUrl.startsWith("https://")) {
    return clip.videoUrl;
  }
  if (clip.videoUrl.startsWith("/generations/")) return clip.videoUrl;
  throw new Error("Cannot resolve clip video source");
}

function trimBounds(clip: TimelineClip) {
  const { start, end, playDuration } = resolveClipPlayRange(clip, clip.durationSec ?? 0);
  const safeEnd = end > start ? end : start + Math.max(0.1, playDuration);
  return {
    start,
    duration: Math.max(0.1, safeEnd - start),
  };
}

function trimInputArgs(inputPath: string, start: number, duration: number): string[] {
  return ["-y", "-i", inputPath, "-ss", String(start), "-t", String(duration)];
}

function canStreamCopyClip(
  clip: TimelineClip,
  probe: VideoProbe,
  quality: EditStudioExportQuality,
): boolean {
  if (quality !== "high") return false;
  if (clipNeedsVideoReencode(clip)) return false;
  return aspectRatioMatches(probe.width, probe.height, clip.exportAspect);
}

async function streamCopyClip(
  inputPath: string,
  outPath: string,
  start: number,
  duration: number,
  hasAudio: boolean,
): Promise<void> {
  const base = trimInputArgs(inputPath, start, duration);
  const attempts: string[][] = [
    [
      ...base,
      "-map",
      "0:v:0",
      ...(hasAudio ? ["-map", "0:a:0"] : []),
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outPath,
    ],
    [
      ...base,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outPath,
    ],
  ];

  let lastErr = "";
  for (const args of attempts) {
    try {
      await runFfmpeg(args);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastErr || "Stream copy failed");
}

async function encodeClipFile(
  inputPath: string,
  outPath: string,
  clip: TimelineClip,
  quality: EditStudioExportQuality,
  probe: VideoProbe,
) {
  const { start, duration } = trimBounds(clip);

  if (canStreamCopyClip(clip, probe, quality)) {
    try {
      await streamCopyClip(inputPath, outPath, start, duration, probe.hasAudio);
      return;
    } catch {
      // Fall through to re-encode (trim/filters/aspect).
    }
  }

  const vf = vfForClipExport(clip.filter, clip.exportAspect, quality, probe.fps);
  const base = trimInputArgs(inputPath, start, duration);
  base.push("-vf", vf);

  const attempts: string[][] = [
    [
      ...base,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      ...encodeVideoArgs(quality),
      ...encodeAudioFilterArgs(),
      ...encodeAudioArgs(quality),
      "-movflags",
      "+faststart",
      "-max_muxing_queue_size",
      "1024",
      outPath,
    ],
    [
      ...base,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-map",
      "0:v:0",
      "-map",
      "1:a",
      "-shortest",
      ...encodeVideoArgs(quality),
      ...encodeAudioArgs(quality),
      "-movflags",
      "+faststart",
      "-max_muxing_queue_size",
      "1024",
      outPath,
    ],
    [
      ...base,
      "-map",
      "0:v:0",
      "-an",
      ...encodeVideoArgs(quality),
      "-movflags",
      "+faststart",
      outPath,
    ],
  ];

  let lastErr = "";
  for (const args of attempts) {
    try {
      await runFfmpeg(args);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastErr || "Clip encode failed");
}

async function concatFiles(
  workDir: string,
  segmentPaths: string[],
  outPath: string,
  quality: EditStudioExportQuality,
) {
  const listPath = path.join(workDir, "concat-list.txt");
  const body = segmentPaths.map((p) => `file '${path.basename(p)}'`).join("\n");
  await writeFile(listPath, body);

  const relOut = path.basename(outPath);
  const relList = path.basename(listPath);

  const muxFlags = ["-fflags", "+genpts", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart"];

  try {
    await runFfmpeg(
      ["-y", "-f", "concat", "-safe", "0", "-i", relList, "-c", "copy", ...muxFlags, relOut],
      workDir,
    );
  } catch {
    await runFfmpeg(
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        relList,
        ...encodeVideoArgs(quality),
        ...encodeAudioFilterArgs(),
        ...encodeAudioArgs(quality),
        ...muxFlags,
        "-max_muxing_queue_size",
        "1024",
        relOut,
      ],
      workDir,
    );
  }
}

export function serverEditExportAvailable(): boolean {
  return serverFfmpegEnabled();
}

export async function exportEditStudioOnServer(input: {
  clips: TimelineClip[];
  quality: EditStudioExportQuality;
  merge: boolean;
}): Promise<Buffer> {
  if (!serverFfmpegEnabled()) {
    throw new Error("Server export unavailable");
  }
  const clips = input.clips.filter((c) => c.videoUrl?.trim());
  if (!clips.length) throw new Error("No clips");

  const workDir = await mkdtemp(path.join(tmpdir(), "vyronix-edit-export-"));
  try {
    const segmentPaths: string[] = [];
    for (let i = 0; i < clips.length; i += 1) {
      const clip = clips[i]!;
      const sourceUrl = await resolveClipSourceUrl(clip);
      const inputPath = path.join(workDir, `in-${i}.mp4`);
      const segPath = path.join(workDir, `seg-${i}.mp4`);
      await downloadSource(sourceUrl, inputPath);
      const probe = await probeVideoFile(inputPath);
      await encodeClipFile(inputPath, segPath, clip, input.quality, probe);
      segmentPaths.push(segPath);
    }

    const outPath = path.join(workDir, "export.mp4");
    if (!input.merge || segmentPaths.length === 1) {
      await copyFile(segmentPaths[0]!, outPath);
    } else {
      await concatFiles(workDir, segmentPaths, outPath, input.quality);
    }

    return await readFile(outPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
