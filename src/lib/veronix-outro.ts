import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FREE_VERONIX_OUTRO_SECONDS } from "@/lib/free-trial";

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

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
      "User-Agent": "VyronixBrandOutro/1.0",
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

async function probeSize(file: string): Promise<{ w: number; h: number }> {
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0:s=x",
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
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || "ffprobe failed"));
    });
  });
  const [ws, hs] = out.split("x");
  const w = Number(ws);
  const h = Number(hs);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) {
    return { w: 854, h: 480 };
  }
  return { w: w - (w % 2), h: h - (h % 2) };
}

/**
 * Download a model clip, append a 2s VYRONIX end card, save under /public/generations.
 * Returns a same-origin path like `/generations/<id>.mp4`.
 */
export async function appendVyronixOutro(sourceUrl: string): Promise<string> {
  const id = `veronix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const publicDir = path.join(process.cwd(), "public", "generations");
  await mkdir(publicDir, { recursive: true });
  const outPublic = path.join(publicDir, `${id}.mp4`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-outro-"));

  const sourcePath = path.join(work, "source.mp4");
  const outroPath = path.join(work, "outro.mp4");
  const normalized = path.join(work, "normalized.mp4");
  const finalTmp = path.join(work, "final.mp4");

  try {
    await downloadToFile(sourceUrl, sourcePath);
    const { w, h } = await probeSize(sourcePath);
    const fontSize = Math.max(40, Math.round(Math.min(w, h) * 0.14));
    const subSize = Math.max(18, Math.round(fontSize * 0.32));

    // Simple reliable end card (no complex alpha expressions — those break on some ffmpeg builds).
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x07090f:s=${w}x${h}:d=${FREE_VERONIX_OUTRO_SECONDS}:r=24`,
      "-vf",
      [
        `drawtext=fontfile=${FONT}:text=VYRONIX:fontsize=${fontSize}:fontcolor=white:borderw=3:bordercolor=0x22f0ff:x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(fontSize * 0.2)}`,
        `drawtext=fontfile=${FONT}:text=AI:fontsize=${subSize}:fontcolor=0x22f0ff:x=(w-text_w)/2:y=(h+text_h)/2+${Math.round(subSize * 0.4)}`,
        "fade=t=in:st=0:d=0.4",
        "fade=t=out:st=1.5:d=0.5",
      ].join(","),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-t",
      String(FREE_VERONIX_OUTRO_SECONDS),
      outroPath,
    ]);

    await run("ffmpeg", [
      "-y",
      "-i",
      sourcePath,
      "-vf",
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      normalized,
    ]);

    // Filter concat is more reliable than concat demuxer across codecs.
    await run("ffmpeg", [
      "-y",
      "-i",
      normalized,
      "-i",
      outroPath,
      "-filter_complex",
      "[0:v][1:v]concat=n=2:v=1:a=0[v]",
      "-map",
      "[v]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
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
