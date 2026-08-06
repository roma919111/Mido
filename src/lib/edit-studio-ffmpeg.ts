import type { EditStudioAspect, EditStudioFilter } from "@/lib/edit-studio-draft";
import type { EditStudioTransition, TimelineClip } from "@/lib/edit-studio-timeline";
import { resolveClipPlayRange } from "@/lib/edit-studio-dialogue";
import { renderTimedSubtitlePngs, type TimedSubtitlePng } from "@/lib/edit-studio-subtitles";

export const TRANSITION_SEC = 0.5;

export const TRANSITION_FFMPEG: Record<Exclude<EditStudioTransition, "none">, string> = {
  fade: "fade",
  dissolve: "fade",
  wipe: "wipeleft",
};

export const FILTER_FFMPEG: Record<EditStudioFilter, string> = {
  none: "",
  cinematic: "eq=contrast=1.12:brightness=-0.04:saturation=1.18",
  vintage: "colorbalance=rs=0.25:gs=0.05:bs=-0.15,eq=saturation=0.82",
  contrast: "eq=contrast=1.38:saturation=1.05",
  bw: "hue=s=0",
};

export const ASPECT_FFMPEG: Record<EditStudioAspect, string> = {
  "16:9": "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
  "9:16": "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
  "1:1": "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080",
};

type FfmpegInstance = {
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  exec: (args: string[]) => Promise<number>;
  on: (event: "progress", cb: (p: { progress: number }) => void) => void;
};

let sharedFfmpeg: Promise<FfmpegInstance> | null = null;

async function loadFfmpeg(onProgress?: (pct: number) => void): Promise<FfmpegInstance> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.round(Math.min(100, Math.max(0, progress * 100))));
    });
  }
  const coreVersion = "0.12.6";
  const base = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/umd`;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg as unknown as FfmpegInstance;
}

/** Reuse loaded FFmpeg.wasm across extractions in the same session. */
function getSharedFfmpeg(onProgress?: (pct: number) => void): Promise<FfmpegInstance> {
  if (!sharedFfmpeg) {
    sharedFfmpeg = loadFfmpeg(onProgress);
  }
  return sharedFfmpeg;
}

function clipAudioBounds(clip: TimelineClip, durationHint = 0) {
  const { start, end, fullClip, playDuration } = resolveClipPlayRange(clip, durationHint);
  return { start, end, fullClip, playDuration };
}

/** Extract trimmed clip audio as 16 kHz mono WAV (client-side FFmpeg.wasm). */
export async function extractClipAudio(
  clip: TimelineClip,
  durationHint = 0,
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getSharedFfmpeg();
  const videoData = await fetchFile(clip.videoUrl);
  await ffmpeg.writeFile("clip-in.mp4", videoData);
  const { start, end, fullClip, playDuration } = clipAudioBounds(clip, durationHint);

  const baseArgs = ["-i", "clip-in.mp4", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"];

  const attempts: string[][] = fullClip
    ? [
        [...baseArgs, "clip-audio.wav"],
        ["-i", "clip-in.mp4", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "64k", "clip-audio.m4a"],
      ]
    : [
        [
          "-ss",
          String(start),
          "-to",
          String(Math.max(start + 0.1, end)),
          "-i",
          "clip-in.mp4",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "pcm_s16le",
          "clip-audio.wav",
        ],
        [
          "-i",
          "clip-in.mp4",
          "-ss",
          String(start),
          "-t",
          String(Math.max(0.1, playDuration)),
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "pcm_s16le",
          "clip-audio.wav",
        ],
      ];

  for (const args of attempts) {
    const out = args[args.length - 1]!;
    const code = await ffmpeg.exec(args);
    if (code !== 0) continue;
    try {
      const data = await ffmpeg.readFile(out);
      if (data?.length) {
        return {
          data,
          mimeType: out.endsWith(".m4a") ? "audio/mp4" : "audio/wav",
        };
      }
    } catch {
      // try next
    }
  }

  return null;
}

const CHUNK_WAV_ARGS = ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"] as const;

async function execAudioSlice(
  ffmpeg: FfmpegInstance,
  absStart: number,
  absEnd: number,
  outName: string,
): Promise<Uint8Array | null> {
  const attempts: string[][] = [
    [
      "-ss",
      String(absStart),
      "-to",
      String(Math.max(absStart + 0.05, absEnd)),
      "-i",
      "clip-in.mp4",
      ...CHUNK_WAV_ARGS,
      outName,
    ],
    [
      "-i",
      "clip-in.mp4",
      "-ss",
      String(absStart),
      "-t",
      String(Math.max(0.05, absEnd - absStart)),
      ...CHUNK_WAV_ARGS,
      outName,
    ],
  ];
  for (const args of attempts) {
    const code = await ffmpeg.exec(args);
    if (code !== 0) continue;
    try {
      const data = await ffmpeg.readFile(outName);
      if (data?.length) return data;
    } catch {
      // try next
    }
  }
  return null;
}

export type AudioChunk = {
  segStart: number;
  segEnd: number;
  data: Uint8Array;
  mimeType: string;
};

/**
 * Split clip audio into time chunks (one FFmpeg load).
 * segStart/segEnd are seconds relative to trimmed clip start.
 */
export async function extractClipAudioChunks(
  clip: TimelineClip,
  durationHint = 0,
  chunkSec = 10,
): Promise<AudioChunk[]> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getSharedFfmpeg();
  const videoData = await fetchFile(clip.videoUrl);
  await ffmpeg.writeFile("clip-in.mp4", videoData);

  const { start: trimStart, playDuration } = resolveClipPlayRange(clip, durationHint);
  const step = Math.max(3, chunkSec);
  const chunks: AudioChunk[] = [];

  for (let segStart = 0; segStart < playDuration; segStart += step) {
    const segEnd = Math.min(segStart + step, playDuration);
    const absStart = trimStart + segStart;
    const absEnd = trimStart + segEnd;
    const outName = `chunk-${segStart}.wav`;
    const data = await execAudioSlice(ffmpeg, absStart, absEnd, outName);
    if (data?.length) {
      chunks.push({ segStart, segEnd, data, mimeType: "audio/wav" });
    }
  }

  return chunks;
}

/** @deprecated Use extractClipAudio — kept for callers expecting MP3. */
export async function extractClipAudioMp3(clip: TimelineClip): Promise<Uint8Array | null> {
  const out = await extractClipAudio(clip);
  return out?.data ?? null;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function vfForClip(clip: TimelineClip): string {
  const parts: string[] = [];
  const ff = FILTER_FFMPEG[clip.filter];
  if (ff) parts.push(ff);
  parts.push(ASPECT_FFMPEG[clip.exportAspect]);
  return parts.filter(Boolean).join(",");
}

async function renderClipSegment(
  ffmpeg: FfmpegInstance,
  clip: TimelineClip,
  index: number,
  fetchFile: (url: string) => Promise<Uint8Array>,
  timedSubtitles?: TimedSubtitlePng[] | null,
): Promise<string> {
  const inputName = `in-${index}.mp4`;
  const outName = `seg-${index}.mp4`;
  await ffmpeg.writeFile(inputName, await fetchFile(clip.videoUrl));

  const end =
    clip.trimEnd > clip.trimStart ? clip.trimEnd : clip.durationSec || clip.trimEnd || 9999;
  const start = Math.max(0, clip.trimStart);

  const vf = vfForClip(clip);
  const cues = timedSubtitles?.filter((c) => c.png?.length) ?? [];

  if (cues.length) {
    for (let i = 0; i < cues.length; i += 1) {
      await ffmpeg.writeFile(`sub-${index}-${i}.png`, cues[i]!.png);
    }

    let filter = vf ? `[0:v]${vf}[vbase]` : `[0:v]copy[vbase]`;
    let prev = "vbase";
    for (let i = 0; i < cues.length; i += 1) {
      const { startSec, endSec } = cues[i]!;
      const outLabel = i === cues.length - 1 ? "out" : `vsub${i}`;
      filter += `;[${prev}][${i + 1}:v]overlay=0:0:enable='between(t,${startSec},${endSec})'[${outLabel}]`;
      prev = outLabel;
    }

    const args = [
      "-ss",
      String(start),
      "-to",
      String(Math.max(start + 0.1, end)),
      "-i",
      inputName,
    ];
    for (let i = 0; i < cues.length; i += 1) {
      args.push("-i", `sub-${index}-${i}.png`);
    }
    args.push(
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outName,
    );
    await ffmpeg.exec(args);
    return outName;
  }

  const args = ["-ss", String(start), "-to", String(Math.max(start + 0.1, end)), "-i", inputName];
  if (vf) args.push("-vf", vf);
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outName,
  );
  await ffmpeg.exec(args);
  return outName;
}

function clipEffectiveDuration(clip: TimelineClip): number {
  return resolveClipPlayRange(clip, clip.durationSec ?? 0).playDuration;
}

function hasAnyTransition(clips: TimelineClip[]): boolean {
  return clips.some(
    (c, i) => i < clips.length - 1 && (c.transitionAfter ?? "none") !== "none",
  );
}

async function concatTwoSegments(
  ffmpeg: FfmpegInstance,
  first: string,
  second: string,
  outName: string,
) {
  const listBody = `file '${first}'\nfile '${second}'`;
  await ffmpeg.writeFile("pair-concat.txt", new TextEncoder().encode(listBody));
  await ffmpeg.exec([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "pair-concat.txt",
    "-c",
    "copy",
    outName,
  ]);
}

async function xfadeTwoSegments(
  ffmpeg: FfmpegInstance,
  first: string,
  second: string,
  transition: Exclude<EditStudioTransition, "none">,
  firstDuration: number,
  outName: string,
) {
  const offset = Math.max(0, firstDuration - TRANSITION_SEC);
  const ffTransition = TRANSITION_FFMPEG[transition];
  await ffmpeg.exec([
    "-i",
    first,
    "-i",
    second,
    "-filter_complex",
    `[0:v][1:v]xfade=transition=${ffTransition}:duration=${TRANSITION_SEC}:offset=${offset}[v]`,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    outName,
  ]);
}

/** Export a single clip (trim + filter + aspect + optional subtitle burn-in). */
export async function exportSingleClip(
  clip: TimelineClip,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await loadFfmpeg(onProgress);
  const playDur = clipEffectiveDuration(clip);
  const timedSubtitles = await renderTimedSubtitlePngs(clip, playDur);
  const outName = await renderClipSegment(ffmpeg, clip, 0, fetchFile, timedSubtitles);
  const data = await ffmpeg.readFile(outName);
  return new Blob([data as BlobPart], { type: "video/mp4" });
}

/** Concatenate all timeline clips in order — 100% client-side. */
export async function mergeTimelineClips(
  clips: TimelineClip[],
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  if (!clips.length) throw new Error("No clips");
  if (clips.length === 1) return exportSingleClip(clips[0]!, onProgress);

  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await loadFfmpeg((pct) => onProgress?.(Math.round(pct * 0.85)));

  const segmentNames: string[] = [];
  for (let i = 0; i < clips.length; i += 1) {
    onProgress?.(Math.round((i / clips.length) * 55));
    const playDur = clipEffectiveDuration(clips[i]!);
    const timedSubtitles = await renderTimedSubtitlePngs(clips[i]!, playDur);
    segmentNames.push(
      await renderClipSegment(ffmpeg, clips[i]!, i, fetchFile, timedSubtitles),
    );
  }

  if (!hasAnyTransition(clips)) {
    const listBody = segmentNames.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(listBody));

    ffmpeg.on("progress", ({ progress }) => {
      onProgress?.(Math.round(55 + progress * 45));
    });

    await ffmpeg.exec([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "concat.txt",
      "-c",
      "copy",
      "merged.mp4",
    ]);
  } else {
    let currentName = segmentNames[0]!;
    let currentDur = clipEffectiveDuration(clips[0]!);

    for (let i = 0; i < clips.length - 1; i += 1) {
      onProgress?.(Math.round(55 + (i / (clips.length - 1)) * 40));
      const nextName = segmentNames[i + 1]!;
      const nextDur = clipEffectiveDuration(clips[i + 1]!);
      const outName = `merged-step-${i}.mp4`;
      const tr = clips[i]!.transitionAfter ?? "none";

      if (tr === "none") {
        await concatTwoSegments(ffmpeg, currentName, nextName, outName);
        currentDur += nextDur;
      } else {
        await xfadeTwoSegments(ffmpeg, currentName, nextName, tr, currentDur, outName);
        currentDur = currentDur + nextDur - TRANSITION_SEC;
      }
      currentName = outName;
    }

    await ffmpeg.exec(["-i", currentName, "-c", "copy", "-movflags", "+faststart", "merged.mp4"]);
    onProgress?.(98);
  }

  const data = await ffmpeg.readFile("merged.mp4");
  return new Blob([data as BlobPart], { type: "video/mp4" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
