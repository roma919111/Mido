/**
 * Smoke: normalize + concat 3 short clips into one MP4 via video-stitch logic.
 * Uses ffmpeg directly (mirrors server concat fallbacks).
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (c) => {
      err += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-800) || `${cmd} failed (${code})`));
    });
  });
}

const work = await mkdtemp(path.join(tmpdir(), "smoke-concat-"));
const outDir = path.join(work, "out");
await mkdir(outDir, { recursive: true });

try {
  const clips = [];
  for (let i = 0; i < 3; i += 1) {
    const raw = path.join(work, `raw-${i}.mp4`);
    // Different sizes/fps to force normalize path.
    const size = i === 0 ? "640x360" : i === 1 ? "1280x720" : "854x480";
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=blue:s=${size}:d=1`,
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      raw,
    ]);
    clips.push(raw);
  }

  const w = 1280;
  const h = 720;
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,unsharp=5:5:1.0:5:5:0.0,eq=contrast=1.18:saturation=1.3:brightness=0.02:gamma=1.04,format=yuv420p`;
  const norms = [];
  for (let i = 0; i < clips.length; i += 1) {
    const norm = path.join(work, `norm-${i}.mp4`);
    await run("ffmpeg", [
      "-y",
      "-i",
      clips[i],
      "-t",
      "4",
      "-vf",
      vf,
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
    norms.push(norm);
  }

  const finalPath = path.join(outDir, "merged.mp4");
  const inputs = norms.flatMap((n) => ["-i", n]);
  const labels = norms.map((_, i) => `[${i}:v][${i}:a]`).join("");
  const filter = `${labels}concat=n=${norms.length}:v=1:a=1[v][a]`;
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
    finalPath,
  ]);

  const st = await stat(finalPath);
  if (st.size < 2000) throw new Error("merged too small");
  console.log("OK smoke-concat", { bytes: st.size, clips: norms.length });
} finally {
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
}
