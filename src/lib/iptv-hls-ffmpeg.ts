import { spawn, type ChildProcess, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";

const ROOT = path.join("/tmp", "vyronix-hls");
const MAX_JOBS = 8;
const LIVE_IDLE_MS = 90_000;
const VOD_IDLE_MS = 15 * 60_000;
const READY_MS = 22_000;

type HlsMode = "live" | "vod";

type HlsJob = {
  id: string;
  dir: string;
  child: ChildProcess;
  lastHit: number;
  stderr: string;
  mode: HlsMode;
};

const jobs = new Map<string, HlsJob>();

export function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

function jobIdFor(target: string): string {
  return createHash("sha1").update(target).digest("hex").slice(0, 16);
}

export function isVodMediaUrl(target: string): boolean {
  if (/\/(movie|series)\//i.test(target)) return true;
  if (/\/live\//i.test(target)) return false;
  return /\.(mkv|mp4|avi|mpg|mpeg|m4v)(?:\?|$)/i.test(target);
}

/** Keep the panel file URL. Do not rewrite movies to a fake .ts/.m3u8 path. */
export function tsUrlForTransmux(target: string): string {
  if (isVodMediaUrl(target)) {
    return target.replace(/\.m3u8(\?|$)/i, ".mkv$1");
  }
  if (/\.ts(?:\?|$)/i.test(target)) return target;
  if (/\.m3u8(?:\?|$)/i.test(target)) return target.replace(/\.m3u8(\?|$)/i, ".ts$1");
  if (/\/live\//i.test(target) && !/\.[a-z0-9]+(?:\?|$)/i.test(target)) return `${target}.ts`;
  return target;
}

function playlistPath(dir: string, name = "index.m3u8"): string {
  return path.join(dir, name);
}

async function fileHasSegments(file: string, min = 1): Promise<boolean> {
  try {
    const buf = await readFile(file, "utf8");
    return (buf.match(/#EXTINF/gi)?.length ?? 0) >= min;
  } catch {
    return false;
  }
}

async function playlistReady(job: HlsJob): Promise<boolean> {
  return fileHasSegments(playlistPath(job.dir), job.mode === "vod" ? 1 : 3);
}

async function waitReady(job: HlsJob, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await playlistReady(job)) return true;
    if (job.child.exitCode != null) return playlistReady(job);
    await new Promise((r) => setTimeout(r, 250));
  }
  return playlistReady(job);
}

function killProc(child?: ChildProcess): void {
  if (!child) return;
  try {
    child.kill("SIGKILL");
  } catch {
    /* already gone */
  }
}

function killJob(job: HlsJob): void {
  killProc(job.child);
  jobs.delete(job.id);
  void rm(job.dir, { recursive: true, force: true });
}

function reapIdle(): void {
  const now = Date.now();
  for (const job of jobs.values()) {
    const idle = job.mode === "vod" ? VOD_IDLE_MS : LIVE_IDLE_MS;
    if (now - job.lastHit > idle) killJob(job);
  }
}

function trimJobs(): void {
  if (jobs.size < MAX_JOBS) return;
  const oldest = [...jobs.values()].sort((a, b) => a.lastHit - b.lastHit)[0];
  if (oldest) killJob(oldest);
}

function attachStderr(child: ChildProcess): void {
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (!text) return;
    const job = [...jobs.values()].find((row) => row.child === child);
    if (job) job.stderr = `${job.stderr}\n${text}`.slice(-1200);
    console.error("[hls-ffmpeg]", text.slice(0, 500));
  });
  child.on("error", (err) => {
    console.error("[hls-ffmpeg] spawn", err.message);
  });
}

function commonInputArgs(target: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-rw_timeout",
    "15000000",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "3",
    "-fflags",
    "+genpts+discardcorrupt",
    "-analyzeduration",
    "4000000",
    "-probesize",
    "4000000",
    "-user_agent",
    "VLC/3.0.20",
    "-i",
    target,
    "-sn",
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
  ];
}

function liveFfmpegArgs(target: string, dir: string, transcode: boolean): string[] {
  const video = transcode
    ? [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "main",
        "-level",
        "4.0",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-crf",
        "23",
        "-maxrate",
        "5000k",
        "-bufsize",
        "10000k",
      ]
    : ["-c:v", "copy"];

  return [
    ...commonInputArgs(target),
    ...video,
    "-c:a",
    "aac",
    "-profile:a",
    "aac_low",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-b:a",
    "128k",
    "-max_muxing_queue_size",
    "2048",
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_list_size",
    "6",
    "-hls_flags",
    "delete_segments+append_list+omit_endlist+round_durations",
    "-hls_segment_filename",
    path.join(dir, "seg%05d.ts"),
    playlistPath(dir),
  ];
}

function vodFfmpegArgs(target: string, dir: string, transcode: boolean): string[] {
  const video = transcode
    ? [
        "-vf",
        "scale=1280:-2",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "main",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-maxrate",
        "2500k",
        "-bufsize",
        "4000k",
      ]
    : ["-c:v", "copy"];

  return [
    ...commonInputArgs(target),
    ...video,
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-b:a",
    "96k",
    "-max_muxing_queue_size",
    "2048",
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_list_size",
    "0",
    "-hls_playlist_type",
    "event",
    "-hls_flags",
    "independent_segments+append_list+round_durations",
    "-hls_segment_filename",
    path.join(dir, "seg%05d.ts"),
    playlistPath(dir),
  ];
}

function startLiveFfmpeg(target: string, dir: string, transcode: boolean): ChildProcess {
  assertSafeIptvUrl(target);
  const child = spawn("ffmpeg", liveFfmpegArgs(target, dir, transcode), {
    stdio: ["ignore", "ignore", "pipe"],
  });
  attachStderr(child);
  return child;
}

function startVodFfmpeg(target: string, dir: string, transcode: boolean): ChildProcess {
  assertSafeIptvUrl(target);
  const child = spawn("ffmpeg", vodFfmpegArgs(target, dir, transcode), {
    stdio: ["ignore", "ignore", "pipe"],
  });
  attachStderr(child);
  return child;
}

function vodMpegtsArgs(target: string, transcode: boolean): string[] {
  const video = transcode
    ? [
        "-vf",
        "scale=1280:-2",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "baseline",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-maxrate",
        "2500k",
        "-bufsize",
        "4000k",
      ]
    : ["-c:v", "copy", "-bsf:v", "h264_mp4toannexb"];

  return [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-rw_timeout",
    "15000000",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "2",
    "-fflags",
    "+genpts+discardcorrupt+nobuffer",
    "-flags",
    "low_delay",
    "-analyzeduration",
    "800000",
    "-probesize",
    "800000",
    "-user_agent",
    "VLC/3.0.20",
    "-i",
    target,
    "-sn",
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    ...video,
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-ar",
    "44100",
    "-b:a",
    "96k",
    "-f",
    "mpegts",
    "-mpegts_flags",
    "resend_headers",
    "pipe:1",
  ];
}

async function bootLiveJob(raw: string, transcode: boolean): Promise<HlsJob> {
  const id = jobIdFor(`${raw}:live:${transcode ? "x" : "c"}`);
  trimJobs();
  const dir = path.join(ROOT, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const child = startLiveFfmpeg(raw, dir, transcode);
  const job: HlsJob = { id, dir, child, lastHit: Date.now(), stderr: "", mode: "live" };
  jobs.set(id, job);
  child.on("exit", (code) => {
    console.error("[hls-ffmpeg] exit", id, code, "live", transcode ? "transcode" : "copy");
  });
  const ready = await waitReady(job, transcode ? 35000 : READY_MS);
  if (!ready) {
    const hint = job.stderr.replace(/\s+/g, " ").trim().slice(0, 180);
    killJob(job);
    throw new Error(hint || "not ready");
  }
  return job;
}

async function bootVodJob(raw: string, transcode: boolean): Promise<HlsJob> {
  const id = jobIdFor(`${raw}:vod:${transcode ? "x" : "c"}`);
  trimJobs();
  const dir = path.join(ROOT, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const child = startVodFfmpeg(raw, dir, transcode);
  const job: HlsJob = { id, dir, child, lastHit: Date.now(), stderr: "", mode: "vod" };
  jobs.set(id, job);
  child.on("exit", (code) => {
    console.error("[hls-ffmpeg] exit", id, code, "vod", transcode ? "transcode" : "copy");
  });
  const ready = await waitReady(job, transcode ? 14000 : 9000);
  if (!ready) {
    const hint = job.stderr.replace(/\s+/g, " ").trim().slice(0, 180);
    killJob(job);
    throw new Error(hint || "not ready");
  }
  return job;
}

async function reuseOrBootLive(raw: string, transcode: boolean): Promise<HlsJob> {
  const id = jobIdFor(`${raw}:live:${transcode ? "x" : "c"}`);
  const existing = jobs.get(id);
  if (existing) {
    existing.lastHit = Date.now();
    if (await playlistReady(existing)) return existing;
    if (existing.child.exitCode == null && (await waitReady(existing, 8000))) return existing;
    killJob(existing);
  }
  return bootLiveJob(raw, transcode);
}

async function reuseOrBootVod(raw: string, transcode: boolean): Promise<HlsJob> {
  const id = jobIdFor(`${raw}:vod:${transcode ? "x" : "c"}`);
  const existing = jobs.get(id);
  if (existing) {
    existing.lastHit = Date.now();
    if (await playlistReady(existing)) return existing;
    if (existing.child.exitCode == null && (await waitReady(existing, 6000))) return existing;
    killJob(existing);
  }
  return bootVodJob(raw, transcode);
}

export async function ensureHlsJob(target: string): Promise<HlsJob> {
  const raw = tsUrlForTransmux(target);
  assertSafeIptvUrl(raw);
  reapIdle();
  const vod = isVodMediaUrl(raw) || isVodMediaUrl(target);

  if (vod) {
    try {
      return await reuseOrBootVod(raw, false);
    } catch (e) {
      console.error("[hls-ffmpeg] vod copy failed, transcoding", e instanceof Error ? e.message : e);
      return reuseOrBootVod(raw, true);
    }
  }

  try {
    return await reuseOrBootLive(raw, false);
  } catch (e) {
    console.error("[hls-ffmpeg] live copy failed, transcoding", e instanceof Error ? e.message : e);
    return reuseOrBootLive(raw, true);
  }
}

export async function readHlsPlaylist(job: HlsJob): Promise<string> {
  job.lastHit = Date.now();
  return readFile(playlistPath(job.dir), "utf8");
}

export async function readHlsTextFile(jobId: string, file: string): Promise<string | null> {
  if (!/^[a-f0-9]{16}$/.test(jobId) || !/^(lo|hi|index)\.m3u8$/i.test(file)) return null;
  const job = jobs.get(jobId);
  if (!job) return null;
  job.lastHit = Date.now();
  try {
    return await readFile(path.join(job.dir, file), "utf8");
  } catch {
    return null;
  }
}

export async function readHlsSegment(jobId: string, file: string): Promise<Buffer | null> {
  if (!/^[a-f0-9]{16}$/.test(jobId) || !/^(seg|lo|hi)\d+\.ts$/i.test(file)) return null;
  const job = jobs.get(jobId);
  if (!job) return null;
  job.lastHit = Date.now();
  try {
    return await readFile(path.join(job.dir, file));
  } catch {
    return null;
  }
}

function nodeToWebStream(child: ChildProcess): ReadableStream<Uint8Array> {
  const stdout = child.stdout;
  if (!stdout) {
    return new ReadableStream({
      start(controller) {
        controller.error(new Error("ffmpeg stdout missing"));
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const onData = (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          killProc(child);
        }
        if (controller.desiredSize !== null && controller.desiredSize <= 0) stdout.pause();
      };
      const onEnd = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const onError = (err: Error) => {
        try {
          controller.error(err);
        } catch {
          /* already closed */
        }
      };
      stdout.on("data", onData);
      stdout.once("end", onEnd);
      stdout.once("error", onError);
      child.once("exit", () => onEnd());
    },
    pull() {
      stdout.resume();
    },
    cancel() {
      killProc(child);
    },
  });
}

export async function streamVodMpegts(target: string, signal?: AbortSignal): Promise<Response> {
  const raw = tsUrlForTransmux(target);
  assertSafeIptvUrl(raw);
  if (!ffmpegAvailable()) throw new Error("ffmpeg unavailable");

  const child = spawn("ffmpeg", vodMpegtsArgs(raw, true), {
    stdio: ["ignore", "pipe", "pipe"],
  });
  attachStderr(child);
  const stop = () => killProc(child);
  signal?.addEventListener("abort", stop, { once: true });
  child.on("exit", (code) => {
    console.error("[hls-ffmpeg] exit pipe x", code);
  });

  return new Response(nodeToWebStream(child), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Content-Type": "video/mp2t",
      "Cache-Control": "no-store",
      "Content-Disposition": "inline; filename=seg.ts",
    },
  });
}
