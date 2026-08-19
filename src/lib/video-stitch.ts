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
  const headerSets: Array<Record<string, string>> = [
    {
      Accept: "video/mp4,video/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (compatible; VyronixVideoStitch/1.2; +https://vyronix.app)",
      Referer: "https://vyronix.app/",
    },
    {
      Accept: "*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://openart.ai/",
      Origin: "https://openart.ai",
    },
  ];
  let lastErr = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const headers = headerSets[attempt % headerSets.length]!;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers,
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) {
        lastErr = "empty body";
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      await writeFile(dest, buf);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "download failed";
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw new Error(`Unable to fetch video (${lastErr})`);
}

/**
 * Free clarity upgrade: clean 480p → ~720p upscale.
 * Mild denoise + edge restore only — no cinematic grade / glow / heavy sat.
 */
export async function applyClarityGrade(inputPath: string, outputPath: string): Promise<void> {
  // Prefer short-side 720 with even dims. Avoid fragile nested if() graphs that
  // fail on some Railway ffmpeg builds; fall back to simple scale ladders.
  const attempts: Array<{ vf: string; extra?: string[] }> = [
    {
      // Landscape → height 720; portrait → width 720. Then even dims + light polish.
      vf:
        "scale='if(gte(iw\\,ih)\\,-2\\,720)':'if(gte(iw\\,ih)\\,720\\,-2)':flags=lanczos," +
        "scale=trunc(iw/2)*2:trunc(ih/2)*2," +
        "hqdn3d=0.8:0.8:2:2,unsharp=5:5:0.55:5:5:0.0,format=yuv420p",
    },
    {
      vf:
        "scale='if(gte(iw\\,ih)\\,-2\\,720)':'if(gte(iw\\,ih)\\,720\\,-2)':flags=lanczos," +
        "scale=trunc(iw/2)*2:trunc(ih/2)*2,unsharp=5:5:0.5:5:5:0.0,format=yuv420p",
    },
    {
      vf: "scale=-2:720:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
    },
    {
      vf: "scale=1280:-2:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
    },
  ];

  let lastErr = "";
  for (const attempt of attempts) {
    try {
      await run("ffmpeg", [
        "-y",
        "-i",
        inputPath,
        "-vf",
        attempt.vf,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-movflags",
        "+faststart",
        ...(attempt.extra || []),
        outputPath,
      ]);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  // Last resort: video-only scale (drop broken audio tracks).
  try {
    await run("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale=-2:720:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
      "-map",
      "0:v:0",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return;
  } catch (err) {
    lastErr = err instanceof Error ? err.message : String(err);
  }

  console.warn("[veronix] clarity grade failed, keeping source:", lastErr.slice(-400));
  await copyFile(inputPath, outputPath);
}

/**
 * Persist a remote (or already-local) clip under `/generations/…`
 * so concat / frame-extract never depend on a fleeting CDN URL.
 * When `clarity` is true, apply the OmarFX-style grade on the saved file.
 */
export async function cacheVideoLocally(
  sourceUrl: string,
  options?: { clarity?: boolean },
): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("Empty video URL");
  const wantClarity = Boolean(options?.clarity);

  if (trimmed.startsWith("/generations/") && !wantClarity) {
    const existing = resolveGenerationFile(trimmed);
    if (!existing) throw new Error("Invalid local generation path");
    return trimmed;
  }

  const id = `${wantClarity ? "grade" : "part"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-cache-"));
  try {
    const tmp = path.join(work, "in.mp4");
    if (trimmed.startsWith("/generations/")) {
      const existing = resolveGenerationFile(trimmed);
      if (!existing) throw new Error("Invalid local generation path");
      await copyFile(existing, tmp);
    } else {
      await downloadToFile(trimmed, tmp);
    }
    if (wantClarity) {
      const graded = path.join(work, "graded.mp4");
      await applyClarityGrade(tmp, graded);
      await copyFile(graded, outPublic);
    } else {
      await copyFile(tmp, outPublic);
    }
    const st = await stat(outPublic);
    if (st.size < 1000) throw new Error("Cached video too small");
    return `/generations/${id}.mp4`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function probeVideoDurationSeconds(
  sourceUrl: string,
): Promise<number | null> {
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-probe-"));
  const videoPath = path.join(work, "in.mp4");
  try {
    await materializeVideo(sourceUrl, videoPath);
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          videoPath,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      child.stdout.on("data", (c: Buffer) => {
        stdout += c.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else resolve("");
      });
    });
    const n = Number.parseFloat(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
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
    await materializeVideo(sourceUrl, videoPath);
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

/** First-frame JPEG for Assets posters / Edit start-frame.
 * Prefer seeking without downloading the whole MP4 (remote URL or local file).
 */
export async function extractFirstFrameJpeg(sourceUrl: string): Promise<Buffer> {
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-poster-"));
  const framePath = path.join(work, "frame.jpg");
  try {
    // 1) Local generations path / file:// — seek on disk, no full copy.
    const localPath = (() => {
      if (sourceUrl.startsWith("file://")) {
        return sourceUrl.replace(/^file:\/\//, "");
      }
      if (sourceUrl.startsWith("/generations/")) {
        return resolveGenerationFile(sourceUrl);
      }
      return null;
    })();
    if (localPath) {
      await run("ffmpeg", [
        "-y",
        "-ss",
        "0.05",
        "-i",
        localPath,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        framePath,
      ]);
      const buf = await readFile(framePath);
      if (buf.length < 200) throw new Error("Poster frame too small");
      return buf;
    }

    // 2) Remote HTTPS — let ffmpeg pull only what it needs (no full arrayBuffer).
    if (/^https?:\/\//i.test(sourceUrl)) {
      try {
        await run("ffmpeg", [
          "-y",
          "-ss",
          "0.05",
          "-i",
          sourceUrl,
          "-frames:v",
          "1",
          "-q:v",
          "3",
          framePath,
        ]);
        const buf = await readFile(framePath);
        if (buf.length >= 200) return buf;
      } catch {
        // Fall through to partial Range fetch.
      }

      // 3) Partial Range (~2MB) — enough for many MP4 first frames.
      try {
        const partial = path.join(work, "partial.mp4");
        const ok = await downloadPartialToFile(sourceUrl, partial, 2 * 1024 * 1024);
        if (ok) {
          await run("ffmpeg", [
            "-y",
            "-ss",
            "0.05",
            "-i",
            partial,
            "-frames:v",
            "1",
            "-q:v",
            "3",
            framePath,
          ]);
          const buf = await readFile(framePath);
          if (buf.length >= 200) return buf;
        }
      } catch {
        // Last resort: full download.
      }
    }

    // 4) Full materialize (legacy / stubborn CDNs).
    const videoPath = path.join(work, "in.mp4");
    await materializeVideo(sourceUrl, videoPath);
    try {
      await run("ffmpeg", [
        "-y",
        "-ss",
        "0.05",
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        framePath,
      ]);
    } catch {
      await run("ffmpeg", ["-y", "-i", videoPath, "-frames:v", "1", "-q:v", "3", framePath]);
    }
    const buf = await readFile(framePath);
    if (buf.length < 200) throw new Error("Poster frame too small");
    return buf;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Download at most `maxBytes` via HTTP Range (best-effort). */
async function downloadPartialToFile(
  url: string,
  dest: string,
  maxBytes: number,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "video/mp4,video/*,*/*;q=0.8",
        Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
        "User-Agent":
          "Mozilla/5.0 (compatible; VyronixVideoStitch/1.2; +https://vyronix.app)",
        Referer: "https://vyronix.app/",
      },
    });
    if (!(res.ok || res.status === 206)) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false;
    await writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function materializeVideo(sourceUrl: string, dest: string) {
  if (sourceUrl.startsWith("file://")) {
    const local = sourceUrl.replace(/^file:\/\//, "");
    await copyFile(local, dest);
    return;
  }
  await downloadToFile(sourceUrl, dest);
}

/**
 * Concatenate N video URLs into one MP4 under `/generations/…`.
 * Normalizes canvas to 1280x720 @ 24fps with stereo AAC.
 * When `maxSecondsPerClip` is set (product default 4), each beat is trimmed.
 * Final output always gets the clarity grade filter.
 */
export async function concatVideos(
  sourceUrls: string[],
  options?: {
    maxSecondsPerClip?: number;
    maxTotalSeconds?: number;
    clarity?: boolean;
  },
): Promise<string> {
  if (sourceUrls.length < 1) throw new Error("No videos to concat");
  const maxSec =
    typeof options?.maxSecondsPerClip === "number" && options.maxSecondsPerClip > 0
      ? options.maxSecondsPerClip
      : 0;
  const trimArgs = maxSec > 0 ? ["-t", String(maxSec)] : [];
  const wantClarity = options?.clarity !== false;

  if (sourceUrls.length === 1) {
    // Still copy into generations for a stable local URL when remote
    const id = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await mkdir(GENERATIONS_DIR, { recursive: true });
    const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
    const work = await mkdtemp(path.join(tmpdir(), "vyronix-one-"));
    try {
      const src = path.join(work, "in.mp4");
      await downloadToFile(sourceUrls[0]!, src);
      let current = src;
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
        current = trimmed;
      }
      if (wantClarity) {
        const graded = path.join(work, "graded.mp4");
        await applyClarityGrade(current, graded);
        await copyFile(graded, outPublic);
      } else {
        await copyFile(current, outPublic);
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
  // Bake a reliable clarity look into normalize (eq/unsharp always available).
  const clarityNormVf = wantClarity
    ? `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,unsharp=5:5:1.0:5:5:0.0,eq=contrast=1.18:saturation=1.3:brightness=0.02:gamma=1.04,format=yuv420p`
    : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p`;

  const plainNormVf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p`;
  const vfCandidates = wantClarity
    ? [clarityNormVf, plainNormVf]
    : [plainNormVf];

  async function normalizeOne(
    raw: string,
    norm: string,
    hasAudio: boolean,
  ): Promise<void> {
    let lastErr: unknown;
    for (const vf of vfCandidates) {
      try {
        if (hasAudio) {
          await run("ffmpeg", [
            "-y",
            "-i",
            raw,
            ...trimArgs,
            "-vf",
            `${vf},setpts=PTS-STARTPTS`,
            "-af",
            "aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS",
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
            "-movflags",
            "+faststart",
            norm,
          ]);
        } else {
          const silenceDur = maxSec > 0 ? String(maxSec) : "30";
          await run("ffmpeg", [
            "-y",
            "-i",
            raw,
            "-f",
            "lavfi",
            "-t",
            silenceDur,
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-vf",
            `${vf},setpts=PTS-STARTPTS`,
            "-af",
            "aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS",
            ...(maxSec > 0 ? ["-t", String(maxSec)] : ["-shortest"]),
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
            "-movflags",
            "+faststart",
            norm,
          ]);
        }
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    // Last resort: scale-only + silent audio track (always mergeable).
    try {
      await run("ffmpeg", [
        "-y",
        "-i",
        raw,
        "-f",
        "lavfi",
        "-t",
        maxSec > 0 ? String(maxSec) : "30",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-vf",
        `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p,setpts=PTS-STARTPTS`,
        ...(maxSec > 0 ? ["-t", String(maxSec)] : ["-shortest"]),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
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
    } catch {
      throw lastErr instanceof Error
        ? lastErr
        : new Error("normalize clip failed");
    }
  }

  try {
    const norms: string[] = [];
    for (let i = 0; i < sourceUrls.length; i += 1) {
      const raw = path.join(work, `raw-${i}.mp4`);
      const norm = path.join(work, `norm-${i}.mp4`);
      await downloadToFile(sourceUrls[i]!, raw);
      const hasAudio = await probeHasAudio(raw);
      await normalizeOne(raw, norm, hasAudio);
      norms.push(norm);
    }

    const finalTmp = path.join(work, "final.mp4");
    const inputs = norms.flatMap((n) => ["-i", n]);
    const reset = norms
      .map(
        (_, i) =>
          `[${i}:v]setpts=PTS-STARTPTS[v${i}];[${i}:a]asetpts=PTS-STARTPTS[a${i}];`,
      )
      .join("");
    const concatIn = norms.map((_, i) => `[v${i}][a${i}]`).join("");
    const filter = `${reset}${concatIn}concat=n=${norms.length}:v=1:a=1[v][a]`;

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

    const maxTotal =
      typeof options?.maxTotalSeconds === "number" && options.maxTotalSeconds > 0
        ? options.maxTotalSeconds
        : 0;
    let output = finalTmp;
    if (maxTotal > 0) {
      const trimmed = path.join(work, "trim-total.mp4");
      await run("ffmpeg", [
        "-y",
        "-i",
        finalTmp,
        "-t",
        String(maxTotal),
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
      output = trimmed;
    }

    // Clarity already applied in per-clip normalize (eq/unsharp). Avoid a second pass.
    await copyFile(output, outPublic);
    const st = await stat(outPublic);
    if (st.size < 2000) throw new Error("Concat output too small");
    return `/generations/${id}.mp4`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
