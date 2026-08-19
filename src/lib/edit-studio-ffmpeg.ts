import type { EditStudioAspect, EditStudioFilter } from "@/lib/edit-studio-draft";
import {
  encodeAudioArgs as sharedEncodeAudioArgs,
  encodeAudioFilterArgs,
  encodeVideoArgs as sharedEncodeVideoArgs,
  vfForClipExport,
} from "@/lib/edit-studio-export-constants";
import type { EditStudioExportQuality } from "@/lib/edit-studio-export-quality";
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
let execProgressHandler: ((localPct: number) => void) | null = null;

type ProgressTick = ((pct: number) => void) & {
  span: (min: number, max: number) => (localPct: number) => void;
};

function createProgressReporter(onProgress?: (pct: number) => void): ProgressTick {
  let peak = 0;
  const tick = (pct: number) => {
    const n = Math.min(99, Math.max(0, Math.round(pct)));
    if (n <= peak) return;
    peak = n;
    onProgress?.(n);
  };
  tick.span = (min: number, max: number) => (localPct: number) => {
    const t = Math.min(1, Math.max(0, localPct / 100));
    tick(min + t * (max - min));
  };
  return tick;
}

async function loadFfmpeg(): Promise<FfmpegInstance> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    execProgressHandler?.(Math.min(100, Math.max(0, progress * 100)));
  });
  const coreVersion = "0.12.6";
  const base = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/umd`;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg as unknown as FfmpegInstance;
}

/** Drop cached WASM instance — frees memory before a heavy export. */
export function resetExportFfmpeg() {
  sharedFfmpeg = null;
}

/** Reuse loaded FFmpeg.wasm across extractions in the same session. */
function getSharedFfmpeg(): Promise<FfmpegInstance> {
  if (!sharedFfmpeg) {
    sharedFfmpeg = loadFfmpeg();
  }
  return sharedFfmpeg;
}

async function withExecProgress<T>(
  onLocalProgress: ((localPct: number) => void) | undefined,
  work: () => Promise<T>,
): Promise<T> {
  execProgressHandler = onLocalProgress ?? null;
  try {
    return await work();
  } finally {
    execProgressHandler = null;
  }
}

async function execOrThrow(ffmpeg: FfmpegInstance, args: string[], label: string) {
  const code = await ffmpeg.exec(args);
  if (code !== 0) {
    throw new Error(`${label} failed (${code})`);
  }
}

async function execFirstOk(
  ffmpeg: FfmpegInstance,
  attempts: { args: string[]; label: string }[],
) {
  let lastErr: Error | null = null;
  for (const attempt of attempts) {
    try {
      await execOrThrow(ffmpeg, attempt.args, attempt.label);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error("Export encode failed");
}

function encodeVideoArgs(quality: EditStudioExportQuality): string[] {
  return sharedEncodeVideoArgs(quality);
}

function encodeAudioArgs(quality: EditStudioExportQuality): string[] {
  return sharedEncodeAudioArgs(quality);
}

function encodeTailArgs(
  quality: EditStudioExportQuality,
  outName: string,
  withAudio: boolean,
): string[] {
  return [
    ...encodeVideoArgs(quality),
    ...(withAudio ? [...encodeAudioFilterArgs(), ...encodeAudioArgs(quality)] : ["-an"]),
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "1024",
    outName,
  ];
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

function vfForClip(clip: TimelineClip, quality: EditStudioExportQuality): string {
  return vfForClipExport(clip.filter, clip.exportAspect, quality);
}

function trimClipInputArgs(inputName: string, start: number, duration: number): string[] {
  return ["-i", inputName, "-ss", String(start), "-t", String(Math.max(0.1, duration))];
}

async function runClipEncode(
  ffmpeg: FfmpegInstance,
  baseArgs: string[],
  quality: EditStudioExportQuality,
  outName: string,
  onExecProgress?: (localPct: number) => void,
) {
  const videoOnlyTail = encodeTailArgs(quality, outName, false);
  await withExecProgress(onExecProgress, () =>
    execFirstOk(ffmpeg, [
      {
        label: "Clip export",
        args: [
          ...baseArgs,
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
          outName,
        ],
      },
      {
        label: "Clip export (silent audio)",
        args: [
          ...baseArgs,
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-map",
          "0:v:0",
          "-map",
          "1:a",
          "-shortest",
          ...encodeTailArgs(quality, outName, true),
        ],
      },
      {
        label: "Clip export (video only)",
        args: [...baseArgs, "-map", "0:v:0", ...videoOnlyTail],
      },
    ]),
  );
}

async function renderClipSegment(
  ffmpeg: FfmpegInstance,
  clip: TimelineClip,
  index: number,
  fetchFile: (url: string) => Promise<Uint8Array>,
  quality: EditStudioExportQuality,
  timedSubtitles?: TimedSubtitlePng[] | null,
  onExecProgress?: (localPct: number) => void,
): Promise<string> {
  const inputName = `in-${index}.mp4`;
  const outName = `seg-${index}.mp4`;
  await ffmpeg.writeFile(inputName, await fetchFile(clip.videoUrl));

  const { start, end, playDuration } = resolveClipPlayRange(clip, clip.durationSec ?? 0);
  const safeEnd = end > start ? end : start + Math.max(0.1, playDuration);
  const trimDuration = Math.max(0.1, safeEnd - start);

  const vf = vfForClip(clip, quality);
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

    const baseArgs = trimClipInputArgs(inputName, start, trimDuration);
    for (let i = 0; i < cues.length; i += 1) {
      baseArgs.push("-i", `sub-${index}-${i}.png`);
    }
    await withExecProgress(onExecProgress, () =>
      execFirstOk(ffmpeg, [
        {
          label: "Subtitle export",
          args: [
            ...baseArgs,
            "-filter_complex",
            filter,
            "-map",
            "[out]",
            "-map",
            "0:a?",
            ...encodeTailArgs(quality, outName, true),
          ],
        },
        {
          label: "Subtitle export (video only)",
          args: [
            ...baseArgs,
            "-filter_complex",
            filter,
            "-map",
            "[out]",
            ...encodeTailArgs(quality, outName, false),
          ],
        },
      ]),
    );
    return outName;
  }

  const baseArgs = trimClipInputArgs(inputName, start, trimDuration);
  if (vf) baseArgs.push("-vf", vf);
  await runClipEncode(ffmpeg, baseArgs, quality, outName, onExecProgress);
  return outName;
}

function clipEffectiveDuration(clip: TimelineClip): number {
  return resolveClipPlayRange(clip, clip.durationSec ?? 0).playDuration;
}

export type ClipByteCache = Map<string, Uint8Array>;

function urlsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    const ua = new URL(a, typeof window !== "undefined" ? window.location.origin : "https://vyronix.app").href;
    const ub = new URL(b, typeof window !== "undefined" ? window.location.origin : "https://vyronix.app").href;
    return ua === ub;
  } catch {
    return a.endsWith(b) || b.endsWith(a);
  }
}

/** Prefetch clip videos into RAM so export survives in-app navigation. */
export async function prefetchClipBytes(
  clips: TimelineClip[],
  onProgress?: (pct: number) => void,
): Promise<ClipByteCache> {
  const cache: ClipByteCache = new Map();
  const urls = [...new Set(clips.map((c) => c.videoUrl.trim()).filter(Boolean))];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i]!;
    const res = await fetch(url, { credentials: "same-origin", cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`تعذّر تحميل المقطع (${res.status})`);
    }
    cache.set(url, new Uint8Array(await res.arrayBuffer()));
    onProgress?.(Math.round(((i + 1) / urls.length) * 12));
  }
  return cache;
}

function resolveFetchFile(byteCache?: ClipByteCache) {
  return async (url: string): Promise<Uint8Array> => {
    if (byteCache) {
      const direct = byteCache.get(url);
      if (direct) return direct;
      for (const [key, bytes] of byteCache.entries()) {
        if (urlsMatch(key, url)) return bytes;
      }
    }
    const { fetchFile } = await import("@ffmpeg/util");
    return fetchFile(url);
  };
}

export type EditStudioExportOptions = {
  byteCache?: ClipByteCache;
  quality?: EditStudioExportQuality;
};

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
  await execFirstOk(ffmpeg, [
    {
      label: "Concat",
      args: ["-f", "concat", "-safe", "0", "-i", "pair-concat.txt", "-c", "copy", "-movflags", "+faststart", outName],
    },
    {
      label: "Concat (re-encode audio)",
      args: [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "pair-concat.txt",
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
        outName,
      ],
    },
  ]);
}

async function xfadeTwoSegments(
  ffmpeg: FfmpegInstance,
  first: string,
  second: string,
  transition: Exclude<EditStudioTransition, "none">,
  firstDuration: number,
  quality: EditStudioExportQuality,
  outName: string,
) {
  const offset = Math.max(0, firstDuration - TRANSITION_SEC);
  const ffTransition = TRANSITION_FFMPEG[transition];
  const videoFilter = `[0:v][1:v]xfade=transition=${ffTransition}:duration=${TRANSITION_SEC}:offset=${offset}[v]`;
  const inputs = ["-i", first, "-i", second];

  await execFirstOk(ffmpeg, [
    {
      label: "Transition (video + aac)",
      args: [
        ...inputs,
        "-filter_complex",
        videoFilter,
        "-map",
        "[v]",
        "-map",
        "0:a?",
        ...encodeVideoArgs(quality),
        ...encodeAudioFilterArgs(),
        ...encodeAudioArgs(quality),
        "-movflags",
        "+faststart",
        "-max_muxing_queue_size",
        "1024",
        outName,
      ],
    },
    {
      label: "Transition (video only)",
      args: [
        ...inputs,
        "-filter_complex",
        videoFilter,
        "-map",
        "[v]",
        ...encodeTailArgs(quality, outName, false),
      ],
    },
  ]);
}

/** Export a single clip (trim + filter + aspect + optional subtitle burn-in). */
export async function exportSingleClip(
  clip: TimelineClip,
  onProgress?: (pct: number) => void,
  options?: EditStudioExportOptions,
): Promise<Blob> {
  const fetchFile = resolveFetchFile(options?.byteCache);
  const quality = options?.quality ?? "standard";
  const tick = createProgressReporter(onProgress);
  tick(5);
  const ffmpeg = await getSharedFfmpeg();
  tick(10);
  const playDur = clipEffectiveDuration(clip);
  const timedSubtitles = await renderTimedSubtitlePngs(clip, playDur);
  tick(15);
  const outName = await renderClipSegment(
    ffmpeg,
    clip,
    0,
    fetchFile,
    quality,
    timedSubtitles,
    tick.span(15, 92),
  );
  tick(95);
  const data = await ffmpeg.readFile(outName);
  tick(99);
  return videoBytesToBlob(data);
}

function videoBytesToBlob(data: Uint8Array | string): Blob {
  if (typeof data === "string") {
    return new Blob([data], { type: "video/mp4" });
  }
  return new Blob([data.slice()], { type: "video/mp4" });
}

function sanitizeDownloadFilename(filename: string): string {
  const trimmed = filename.trim() || "vyronix-export.mp4";
  return trimmed.replace(/[^\w.\-()+]/g, "_").replace(/\.(mp4)+$/i, "") + ".mp4";
}

const EXPORT_TAB_SHELL = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Vyronix Export</title>
<style>@keyframes vx-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}</style></head>
<body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0d12;color:#fff;padding:24px;text-align:center;box-sizing:border-box">
<p id="vx-msg" style="font-size:18px;font-weight:700;margin:0 0 16px">جاري التصدير… / Exporting…</p>
<div style="width:min(320px,88vw);height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;position:relative">
  <div id="vx-bar" style="position:absolute;inset:0;width:35%;background:linear-gradient(135deg,#22f0ff,#7c5cff);animation:vx-slide 1.4s ease-in-out infinite"></div>
</div>
<p id="vx-pct" style="opacity:.6;margin:16px 0 0">قد يستغرق دقيقة أو أكثر…</p>
</body></html>`;

/** Open tab on user click (sync) — required so popup blockers allow it. */
export function openExportDeliveryTab(title = "Vyronix Export"): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (!tab) return null;
  tab.document.open();
  tab.document.write(EXPORT_TAB_SHELL);
  tab.document.close();
  tab.document.title = title;
  return tab;
}

export function updateExportDeliveryTab(
  tab: Window | null,
  _pct: number,
  message = "جاري التصدير… / Exporting…",
) {
  if (!tab || tab.closed) return;
  try {
    const msgEl = tab.document.getElementById("vx-msg");
    if (msgEl) msgEl.textContent = message;
  } catch {
    /* tab closed */
  }
}

function writeExportTabHtml(tab: Window, body: string, title: string) {
  tab.document.title = title;
  tab.document.open();
  tab.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0d12;color:#fff;padding:24px;text-align:center;box-sizing:border-box">${body}</body></html>`);
  tab.document.close();
}

/** Show video + download in the delivery tab; fallback to anchor download. */
export function deliverExportInTab(
  tab: Window | null,
  blob: Blob,
  filename: string,
): boolean {
  const safe = sanitizeDownloadFilename(filename);
  const url = URL.createObjectURL(blob);

  if (tab && !tab.closed) {
    try {
      writeExportTabHtml(
        tab,
        `<video src="${url}" controls autoplay playsinline style="width:100%;max-width:960px;max-height:75vh;border-radius:12px;background:#000"></video>
         <a id="dl" href="${url}" download="${safe}" style="display:inline-flex;margin-top:20px;padding:14px 28px;border-radius:999px;background:linear-gradient(135deg,#22f0ff,#7c5cff);color:#0b0d12;font-weight:700;text-decoration:none">تحميل / Download MP4</a>
         <p style="opacity:.5;font-size:12px;margin-top:12px">اضغط الزر أعلاه لتحميل الملف / Click above to download</p>`,
        safe,
      );
      return true;
    } catch {
      try {
        tab.location.href = url;
        return true;
      } catch {
        /* fall through */
      }
    }
  }

  downloadBlob(blob, safe);
  return false;
}

export function showExportErrorInTab(tab: Window | null, message: string) {
  if (!tab || tab.closed) return;
  try {
    writeExportTabHtml(
      tab,
      `<p style="color:#fca5a5;font-size:16px;font-weight:700">${message}</p>`,
      "Export failed",
    );
  } catch {
    tab.close();
  }
}

/** Stable object URL — caller revokes via {@link revokeVideoBlobUrl}. */
export function createVideoBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeVideoBlobUrl(url: string | null | undefined) {
  if (url) URL.revokeObjectURL(url);
}

/**
 * Native save dialog when supported (Chrome / Edge desktop).
 * Returns true if the user saved, false if unavailable or cancelled.
 */
export async function trySaveVideoBlobPicker(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  const safeName = sanitizeDownloadFilename(filename);

  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) {
    return false;
  }

  try {
    const handle = await (
      window as Window & {
        showSaveFilePicker: (options: {
          suggestedName?: string;
          types?: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<FileSystemFileHandle>;
      }
    ).showSaveFilePicker({
      suggestedName: safeName,
      types: [{ description: "MP4 video", accept: { "video/mp4": [".mp4"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    return false;
  }
}

/** One-shot programmatic download (prefer banner link to avoid browser retry loops). */
export function downloadBlob(blob: Blob, filename: string) {
  const safeName = sanitizeDownloadFilename(filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.style.display = "none";
  document.body.appendChild(a);
  requestAnimationFrame(() => {
    a.click();
    window.setTimeout(() => a.remove(), 4_000);
  });
  window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
}
export async function mergeTimelineClips(
  clips: TimelineClip[],
  onProgress?: (pct: number) => void,
  options?: EditStudioExportOptions,
): Promise<Blob> {
  if (!clips.length) throw new Error("No clips");
  if (clips.length === 1) return exportSingleClip(clips[0]!, onProgress, options);

  const fetchFile = resolveFetchFile(options?.byteCache);
  const quality = options?.quality ?? "standard";
  const tick = createProgressReporter(onProgress);
  tick(5);
  const ffmpeg = await getSharedFfmpeg();
  tick(10);

  const segmentNames: string[] = [];
  const segmentBudget = 60;
  for (let i = 0; i < clips.length; i += 1) {
    const segMin = 10 + (i / clips.length) * segmentBudget;
    const segMax = 10 + ((i + 1) / clips.length) * segmentBudget;
    tick(segMin);
    const playDur = clipEffectiveDuration(clips[i]!);
    const timedSubtitles = await renderTimedSubtitlePngs(clips[i]!, playDur);
    segmentNames.push(
      await renderClipSegment(
        ffmpeg,
        clips[i]!,
        i,
        fetchFile,
        quality,
        timedSubtitles,
        tick.span(segMin, segMax),
      ),
    );
    tick(segMax);
  }

  tick(72);
  const useTransitions = hasAnyTransition(clips) && quality !== "high";
  if (!useTransitions) {
    const listBody = segmentNames.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(listBody));
    await withExecProgress(tick.span(72, 92), () =>
      execFirstOk(ffmpeg, [
        {
          label: "Merge",
          args: [
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            "concat.txt",
            "-c",
            "copy",
            "-fflags",
            "+genpts",
            "-avoid_negative_ts",
            "make_zero",
            "-movflags",
            "+faststart",
            "merged.mp4",
          ],
        },
        {
          label: "Merge (re-encode)",
          args: [
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            "concat.txt",
            ...encodeVideoArgs(quality),
            ...encodeAudioFilterArgs(),
            ...encodeAudioArgs(quality),
            "-movflags",
            "+faststart",
            "-max_muxing_queue_size",
            "1024",
            "merged.mp4",
          ],
        },
      ]),
    );
  } else {
    let currentName = segmentNames[0]!;
    let currentDur = clipEffectiveDuration(clips[0]!);
    const steps = clips.length - 1;

    for (let i = 0; i < steps; i += 1) {
      const stepMin = 72 + (i / steps) * 18;
      const stepMax = 72 + ((i + 1) / steps) * 18;
      const nextName = segmentNames[i + 1]!;
      const nextDur = clipEffectiveDuration(clips[i + 1]!);
      const outName = `merged-step-${i}.mp4`;
      const tr = clips[i]!.transitionAfter ?? "none";

      await withExecProgress(tick.span(stepMin, stepMax), async () => {
        if (tr === "none") {
          await concatTwoSegments(ffmpeg, currentName, nextName, outName);
          currentDur += nextDur;
        } else {
          await xfadeTwoSegments(ffmpeg, currentName, nextName, tr, currentDur, quality, outName);
          currentDur = currentDur + nextDur - TRANSITION_SEC;
        }
      });
      currentName = outName;
    }

    await withExecProgress(tick.span(90, 94), () =>
      execOrThrow(
        ffmpeg,
        ["-i", currentName, "-c", "copy", "-movflags", "+faststart", "merged.mp4"],
        "Finalize",
      ),
    );
  }

  tick(96);
  const data = await ffmpeg.readFile("merged.mp4");
  tick(99);
  return videoBytesToBlob(data);
}

