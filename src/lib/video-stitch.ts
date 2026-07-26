/**
 * ffmpeg helpers: extract last frame + concat N videos into one MP4.
 */

import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GENERATIONS_DIR, resolveGenerationFile } from "@/lib/veronix-outro";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-1200) || `${cmd} failed (${code})`));
    });
  });
}

async function downloadToFile(url: string, dest: string) {
  if (url.startsWith("/generations/")) {
    const existing = resolveGenerationFile(url);
    if (!existing) throw new Error("Invalid local generation path");
    await copyFile(existing, dest);
    return;
  }
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          Accept: "video/mp4,video/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (compatible; VyronixVideoStitch/1.1; +https://vyronix.app)",
          Referer: "https://vyronix.app/",
        },
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) {
        lastErr = "empty body";
        continue;
      }
      await writeFile(dest, buf);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "download failed";
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw new Error(`Failed to download video (${lastErr})`);
}

/**
 * Persist a remote (or already-local) clip under `/generations/…`
 * so concat / frame-extract never depend on a fleeting CDN URL.
 */
export async function cacheVideoLocally(sourceUrl: string): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("Empty video URL");
  if (trimmed.startsWith("/generations/")) {
    const existing = resolveGenerationFile(trimmed);
    if (!existing) throw new Error("Invalid local generation path");
    return trimmed;
  }
  const id = `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-cache-"));
  try {
    const tmp = path.join(work, "in.mp4");
    await downloadToFile(trimmed, tmp);
    await copyFile(tmp, outPublic);
    const st = await stat(outPublic);
    if (st.size < 1000) throw new Error("Cached video too small");
    return `/generations/${id}.mp4`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function probeHasAudio(file: string): Promise<boolean> {
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else resolve("");
    });
  });
  return /audio/i.test(out);
}

/** Extract near-last frame as JPEG bytes. */
export async function extractLastFrameJpeg(sourceUrl: string): Promise<Buffer> {
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-frame-"));
  const videoPath = path.join(work, "in.mp4");
  const framePath = path.join(work, "frame.jpg");
  try {
    await downloadToFile(sourceUrl, videoPath);
    // Seek near end; fallback to first frame if seek fails.
    try {
      await run("ffmpeg", [
        "-y",
        "-sseof",
        "-0.12",
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        framePath,
      ]);
    } catch {
      await run("ffmpeg", ["-y", "-i", videoPath, "-frames:v", "1", "-q:v", "2", framePath]);
    }
    const buf = await readFile(framePath);
    if (buf.length < 200) throw new Error("Extracted frame too small");
    return buf;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Concatenate N video URLs into one MP4 under `/generations/…`.
 * Normalizes canvas to 1280x720 @ 24fps with stereo AAC.
 * When `maxSecondsPerClip` is set (product default 2), each beat is trimmed.
 */
export async function concatVideos(
  sourceUrls: string[],
  options?: { maxSecondsPerClip?: number },
): Promise<string> {
  if (sourceUrls.length < 1) throw new Error("No videos to concat");
  const maxSec =
    typeof options?.maxSecondsPerClip === "number" && options.maxSecondsPerClip > 0
      ? options.maxSecondsPerClip
      : 0;
  const trimArgs = maxSec > 0 ? ["-t", String(maxSec)] : [];

  if (sourceUrls.length === 1) {
    // Still copy into generations for a stable local URL when remote
    const id = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await mkdir(GENERATIONS_DIR, { recursive: true });
    const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
    const work = await mkdtemp(path.join(tmpdir(), "vyronix-one-"));
    try {
      const src = path.join(work, "in.mp4");
      await downloadToFile(sourceUrls[0]!, src);
      if (maxSec > 0) {
        const trimmed = path.join(work, "trim.mp4");
        await run("ffmpeg", [
          "-y",
          "-i",
          src,
          ...trimArgs,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          trimmed,
        ]);
        await copyFile(trimmed, outPublic);
      } else {
        await copyFile(src, outPublic);
      }
      return `/generations/${id}.mp4`;
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  const id = `seq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-concat-"));
  const w = 1280;
  const h = 720;

  try {
    const norms: string[] = [];
    for (let i = 0; i < sourceUrls.length; i += 1) {
      const raw = path.join(work, `raw-${i}.mp4`);
      const norm = path.join(work, `norm-${i}.mp4`);
      await downloadToFile(sourceUrls[i]!, raw);
      const hasAudio = await probeHasAudio(raw);
      if (hasAudio) {
        await run("ffmpeg", [
          "-y",
          "-i",
          raw,
          ...trimArgs,
          "-vf",
          `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p`,
          "-af",
          "aformat=sample_rates=44100:channel_layouts=stereo",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-ar",
          "44100",
          "-ac",
          "2",
          norm,
        ]);
      } else {
        await run("ffmpeg", [
          "-y",
          "-i",
          raw,
          ...trimArgs,
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-vf",
          `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p`,
          "-shortest",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-ar",
          "44100",
          "-ac",
          "2",
          norm,
        ]);
      }
      norms.push(norm);
    }

    const finalTmp = path.join(work, "final.mp4");
    const inputs = norms.flatMap((n) => ["-i", n]);
    const labels = norms.map((_, i) => `[${i}:v][${i}:a]`).join("");
    const filter = `${labels}concat=n=${norms.length}:v=1:a=1[v][a]`;

    try {
      await run("ffmpeg", [
        "-y",
        ...inputs,
        "-filter_complex",
        filter,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        finalTmp,
      ]);
    } catch {
      // Fallback: concat demuxer (re-encode for safety)
      const listFile = path.join(work, "list.txt");
      const listBody = norms.map((n) => `file '${n.replace(/'/g, "'\\''")}'`).join("\n");
      await writeFile(listFile, listBody, "utf8");
      await run("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        finalTmp,
      ]);
    }

    await copyFile(finalTmp, outPublic);
    const st = await stat(outPublic);
    if (st.size < 2000) throw new Error("Concat output too small");
    return `/generations/${id}.mp4`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
