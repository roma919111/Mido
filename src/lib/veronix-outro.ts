import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile, stat, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FREE_VERONIX_OUTRO_SECONDS } from "@/lib/free-trial";

const BUNDLED_FONT = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "DejaVuSans-Bold.ttf",
);
const SYSTEM_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const STOCK_OUTRO = path.join(process.cwd(), "public", "promo", "veronix-action.mp4");

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

async function resolveFont(): Promise<string> {
  for (const candidate of [BUNDLED_FONT, SYSTEM_FONT]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("VYRONIX font missing (bundle assets/fonts/DejaVuSans-Bold.ttf)");
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

export function resolveGenerationFile(localPath: string): string | null {
  if (!localPath.startsWith("/generations/")) return null;
  const name = path.basename(localPath);
  if (!name || name !== localPath.replace(/^\/generations\//, "")) return null;
  if (!/^[\w.-]+\.mp4$/i.test(name)) return null;
  return path.join(GENERATIONS_DIR, name);
}

/**
 * Download a 4s model clip, burn a persistent VYRONIX watermark, append a 2s
 * Netflix-style stock end card, and save under `.data/generations`.
 * Returns a same-origin path like `/generations/<id>.mp4`.
 */
export async function appendVyronixOutro(sourceUrl: string): Promise<string> {
  const id = `veronix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.mp4`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-outro-"));

  const sourcePath = path.join(work, "source.mp4");
  const outroPath = path.join(work, "outro.mp4");
  const normalized = path.join(work, "normalized.mp4");
  const finalTmp = path.join(work, "final.mp4");
  const font = await resolveFont();

  try {
    if (sourceUrl.startsWith("/generations/")) {
      const existing = resolveGenerationFile(sourceUrl);
      if (!existing) throw new Error("Invalid local source");
      await copyFile(existing, sourcePath);
    } else {
      await downloadToFile(sourceUrl, sourcePath);
    }

    const { w, h } = await probeSize(sourcePath);
    const markSize = Math.max(22, Math.round(Math.min(w, h) * 0.055));
    const endSize = Math.max(40, Math.round(Math.min(w, h) * 0.14));
    const pad = Math.max(16, Math.round(markSize * 0.9));

    // Main clip: normalize + persistent corner watermark (Netflix-style bug).
    await run("ffmpeg", [
      "-y",
      "-i",
      sourcePath,
      "-vf",
      [
        `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
        `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
        "setsar=1",
        "fps=24",
        "format=yuv420p",
        `drawtext=fontfile=${font}:text='VYRONIX':fontsize=${markSize}:fontcolor=white@0.88:borderw=2:bordercolor=black@0.5:x=w-text_w-${pad}:y=${pad}`,
      ].join(","),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      normalized,
    ]);

    // 2s stock end card from promo reel (fallback: solid cinematic card).
    let usedStock = false;
    try {
      await access(STOCK_OUTRO);
      await run("ffmpeg", [
        "-y",
        "-ss",
        "0",
        "-t",
        String(FREE_VERONIX_OUTRO_SECONDS),
        "-i",
        STOCK_OUTRO,
        "-vf",
        [
          `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
          `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
          "setsar=1",
          "fps=24",
          "format=yuv420p",
          "eq=brightness=-0.18:saturation=0.8",
          `drawtext=fontfile=${font}:text='VYRONIX':fontsize=${endSize}:fontcolor=white:borderw=3:bordercolor=0x22f0ff:x=(w-text_w)/2:y=(h-text_h)/2`,
          "fade=t=in:st=0:d=0.35",
          "fade=t=out:st=1.45:d=0.5",
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
      usedStock = true;
    } catch {
      usedStock = false;
    }

    if (!usedStock) {
      await run("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=0x07090f:s=${w}x${h}:d=${FREE_VERONIX_OUTRO_SECONDS}:r=24`,
        "-vf",
        [
          `drawtext=fontfile=${font}:text=VYRONIX:fontsize=${endSize}:fontcolor=white:borderw=3:bordercolor=0x22f0ff:x=(w-text_w)/2:y=(h-text_h)/2`,
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
    }

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
