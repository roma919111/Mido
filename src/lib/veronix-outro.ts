import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FREE_VERONIX_OUTRO_SECONDS } from "@/lib/free-trial";

const FONT =
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

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
      else reject(new Error(err.slice(-800) || `${cmd} failed (${code})`));
    });
  });
}

async function downloadToFile(url: string, dest: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to download source video (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
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
  // Even dimensions required by many encoders.
  return { w: w - (w % 2), h: h - (h % 2) };
}

/**
 * Download a model clip, append a 2s cinematic VYRONIX end card, save under /public/generations.
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
  const concatList = path.join(work, "list.txt");
  const normalized = path.join(work, "normalized.mp4");
  const finalTmp = path.join(work, "final.mp4");

  try {
    await downloadToFile(sourceUrl, sourcePath);
    const { w, h } = await probeSize(sourcePath);
    const fontSize = Math.max(36, Math.round(Math.min(w, h) * 0.12));

    // Cinematic end card: dark grade, soft fade, centered VYRONIX wordmark.
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x07090f:s=${w}x${h}:d=${FREE_VERONIX_OUTRO_SECONDS}:r=24`,
      "-vf",
      [
        `drawtext=fontfile=${FONT}:text='VYRONIX':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=0x22f0ff@0.55:x=(w-text_w)/2:y=(h-text_h)/2-12:alpha='if(lt(t,0.35),t/0.35,if(gt(t,1.55),(2-t)/0.45,1))'`,
        `drawtext=fontfile=${FONT}:text='AI STUDIO':fontsize=${Math.round(fontSize * 0.28)}:fontcolor=0x22f0ff:x=(w-text_w)/2:y=(h+text_h)/2+8:alpha='if(lt(t,0.55),0,if(lt(t,0.9),(t-0.55)/0.35,if(gt(t,1.55),(2-t)/0.45,1)))'`,
        "fade=t=in:st=0:d=0.35",
        "fade=t=out:st=1.55:d=0.45",
      ].join(","),
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-t",
      String(FREE_VERONIX_OUTRO_SECONDS),
      outroPath,
    ]);

    // Normalize model clip to same size/fps (no audio in concat for reliability).
    await run("ffmpeg", [
      "-y",
      "-i",
      sourcePath,
      "-vf",
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      normalized,
    ]);

    await writeFile(
      concatList,
      `file '${normalized.replace(/'/g, "'\\''")}'\nfile '${outroPath.replace(/'/g, "'\\''")}'\n`,
    );

    await run("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatList,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      finalTmp,
    ]);

    await copyFile(finalTmp, outPublic);
    return `/generations/${id}.mp4`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
