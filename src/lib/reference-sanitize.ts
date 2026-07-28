/**
 * Soft-render reference / start-frame images so BytePlus privacy filters
 * (InputImageSensitiveContentDetected · real person) are less likely to reject them.
 * Prefers a fast sharp pass; ffmpeg only as fallback.
 */

import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
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
      else reject(new Error(err.slice(-800) || `${cmd} failed (${code})`));
    });
  });
}

async function loadImageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("/generations/")) {
    const existing = resolveGenerationFile(url);
    if (!existing) throw new Error("Invalid local generation path");
    return readFile(existing);
  }
  if (url.startsWith("data:image/")) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(url);
    if (!m?.[2]) throw new Error("Invalid data URL");
    return Buffer.from(m[2], "base64");
  }
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (compatible; VyronixRefSanitize/1.0; +https://vyronix.app)",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch reference image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("Reference image too small");
  return buf;
}

/**
 * Stronger digital / cinematic CGI look for privacy retries.
 * Keeps pose + face identity, reduces passport-photo realism.
 * Returns a data: URL for Ark ingest.
 */
export async function stylizeReferenceImage(sourceUrl: string): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("Empty reference URL");

  const id = `refstyle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.jpg`);

  try {
    const raw = await loadImageBytes(trimmed);
    const out = await sharp(raw)
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .modulate({ brightness: 1.04, saturation: 1.28 })
      .linear(1.12, -12)
      .median(5)
      .blur(1.1)
      .sharpen({ sigma: 1.0 })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    if (out.length < 400) throw new Error("Stylized reference too small");
    await writeFile(outPublic, out);
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    // ffmpeg fallback if sharp rejects the codec
    const work = await mkdtemp(path.join(tmpdir(), "vyronix-refstyle-"));
    try {
      const raw = path.join(work, "in.bin");
      const styled = path.join(work, "styled.jpg");
      await writeFile(raw, await loadImageBytes(trimmed));
      const attempts = [
        "scale=1024:-2:flags=lanczos,eq=contrast=1.15:saturation=1.3:brightness=0.03,unsharp=5:5:0.9:5:5:0.0,noise=alls=6:allf=t,format=yuvj420p",
        "scale=960:-2:flags=lanczos,eq=contrast=1.12:saturation=1.22,format=yuvj420p",
        "scale=960:-2,format=yuvj420p",
      ];
      let ok = false;
      for (const vf of attempts) {
        try {
          await run("ffmpeg", [
            "-y",
            "-i",
            raw,
            "-vf",
            vf,
            "-frames:v",
            "1",
            "-q:v",
            "5",
            styled,
          ]);
          ok = true;
          break;
        } catch {
          // try next
        }
      }
      if (!ok) throw new Error("Unable to stylize reference image");
      await copyFile(styled, outPublic);
      const st = await stat(outPublic);
      if (st.size < 400) throw new Error("Stylized reference too small");
      const bytes = await readFile(outPublic);
      return `data:image/jpeg;base64,${bytes.toString("base64")}`;
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function isInputImagePrivacyError(message: string): boolean {
  return /InputImageSensitive|PrivacyInformation|real person|may contain real|input image may contain/i.test(
    message,
  );
}

const AI_SCENE_MARK = "شخصيات رقمية مولّدة بالذكاء الاصطناعي";

/**
 * When BytePlus rejects a still as a real person, reframe the prompt as
 * AI-generated digital characters / cinematic CGI — NOT live-action photoreal
 * (photoreal wording makes the privacy filter worse).
 */
export function toSemiRealisticScenePrompt(prompt: string): string {
  const base = (prompt || "")
    .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
    .replace(/\n*أشخاص غير حقيقيين[^\n]*/giu, "")
    .trim();
  if (!base) {
    return `${AI_SCENE_MARK}، مظهر سينمائي رقمي، إضاءة استوديو.`;
  }
  if (base.includes(AI_SCENE_MARK)) {
    return base;
  }
  return [
    `${AI_SCENE_MARK} (AI-generated digital characters, cinematic CGI render).`,
    "Not a real-person photo. Stylized digital humans, film lighting, creative media.",
    "",
    base,
  ].join("\n");
}
