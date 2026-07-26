import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile, stat, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FREE_VERONIX_STOCK_PATH } from "@/lib/free-trial";

const STOCK_INTRO = path.join(process.cwd(), FREE_VERONIX_STOCK_PATH);

/** Persistent generations live on the Railway volume under `.data`. */
export const GENERATIONS_DIR = path.join(process.cwd(), ".data", "generations");

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
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "*/*",
      "User-Agent": "VyronixBrandIntro/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download source video (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error("Downloaded source video is empty");
  }
  await writeFile(dest, buf);
}

async function probeJson(file: string): Promise<{
  w: number;
  h: number;
  fps: string;
  hasAudio: boolean;
}> {
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_type,width,height,r_frame_rate",
        "-of",
        "json",
        file,
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
  const video = parsed.streams?.find((s) => s.codec_type === "video");
  const hasAudio = Boolean(parsed.streams?.some((s) => s.codec_type === "audio"));
  const w = Number(video?.width) || 1280;
  const h = Number(video?.height) || 720;
  return {
    w: w - (w % 2),
    h: h - (h % 2),
    fps: video?.r_frame_rate && video.r_frame_rate !== "0/0" ? video.r_frame_rate : "24/1",
    hasAudio,
  };
}

export function resolveGenerationFile(localPath: string): string | null {
  if (!localPath.startsWith("/generations/")) return null;
  const name = path.basename(localPath);
  if (!name || name !== localPath.replace(/^\/generations\//, "")) return null;
  if (!/^[\w.-]+\.mp4$/i.test(name)) return null;
  return path.join(GENERATIONS_DIR, name);
}

/**
 * Free-trial branding:
 * 1) Owner stock intro as-is (no overlays/trimming)
 * 2) Generated OpenArt clip (keeps its audio)
 * Saved under `.data/generations` → `/generations/<id>.mp4`
 */
export async function appendVyronixOutro(sourceUrl: string): Promise<string> {
  const id = `veronix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-brand-"));

  const sourcePath = path.join(work, "source.mp4");
  const stockNorm = path.join(work, "stock.mp4");
  const genNorm = path.join(work, "generated.mp4");
  const finalTmp = path.join(work, "final.mp4");

  try {
    await access(STOCK_INTRO);

    if (sourceUrl.startsWith("/generations/")) {
      const existing = resolveGenerationFile(sourceUrl);
      if (!existing) throw new Error("Invalid local source");
      await copyFile(existing, sourcePath);
    } else {
      await downloadToFile(sourceUrl, sourcePath);
    }

    const stockMeta = await probeJson(STOCK_INTRO);
    const genMeta = await probeJson(sourcePath);
    const w = stockMeta.w;
    const h = stockMeta.h;

    // Normalize stock for concat only (no creative edits / no trim).
    await run("ffmpeg", [
      "-y",
      "-i",
      STOCK_INTRO,
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
      stockNorm,
    ]);

    // Generated clip: match canvas, keep original audio when present.
    if (genMeta.hasAudio) {
      await run("ffmpeg", [
        "-y",
        "-i",
        sourcePath,
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
        genNorm,
      ]);
    } else {
      await run("ffmpeg", [
        "-y",
        "-i",
        sourcePath,
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
        genNorm,
      ]);
    }

    // Stock FIRST, then generated model clip (both with audio).
    await run("ffmpeg", [
      "-y",
      "-i",
      stockNorm,
      "-i",
      genNorm,
      "-filter_complex",
      "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
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

    await copyFile(finalTmp, outPublic);
    const st = await stat(outPublic);
    if (st.size < 2000) {
      throw new Error("Branded output too small");
    }
    return `/generations/${id}.mp4`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
