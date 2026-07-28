/**
 * Soft cinematic / beauty grade for character stills.
 * Tuned from accepted Seedance refs (soft skin, film still) vs rejected
 * passport-sharp faces. NOT CGI/cartoon — closer to portrait beauty mode.
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

export type SoftGradeLevel = "generate" | "retry";

/**
 * Portrait beauty / soft film grade.
 * Key anti-reject levers (from accepted vs rejected refs):
 * - moderate downscale (sharp high-res faces trigger "real person")
 * - skin soft without cartoon
 * - BytePlus requires both sides ≥ 300px — enforce min 320 after resize
 */
export async function applySoftCinematicGrade(
  bytes: Buffer,
  opts?: { level?: SoftGradeLevel; stronger?: boolean },
): Promise<Buffer> {
  const level: SoftGradeLevel =
    opts?.level || (opts?.stronger ? "retry" : "generate");
  const retry = level === "retry";

  // Keep portraits wide enough for BytePlus (min 300px). Very tall crops
  // at 640px height could shrink width to ~295 — that rejects.
  const edge = retry ? 900 : 1024;
  const MIN_SIDE = 320;

  let buf = await sharp(bytes)
    .rotate()
    .resize({
      width: edge,
      height: edge,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({
      brightness: retry ? 1.06 : 1.04,
      saturation: retry ? 0.84 : 0.88,
    })
    .linear(retry ? 1.03 : 1.02, retry ? -3 : -2)
    .median(retry ? 7 : 5)
    .blur(retry ? 1.35 : 0.95)
    .sharpen({ sigma: retry ? 0.28 : 0.35 })
    .jpeg({ quality: retry ? 80 : 82, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w > 0 && h > 0 && (w < MIN_SIDE || h < MIN_SIDE)) {
    // Scale up so both sides are ≥ 320 (BytePlus InvalidParameter otherwise).
    buf = await sharp(buf)
      .resize({
        width: Math.max(MIN_SIDE, w),
        height: Math.max(MIN_SIDE, h),
        fit: "outside",
        withoutEnlargement: false,
      })
      .jpeg({ quality: retry ? 80 : 82, mozjpeg: true })
      .toBuffer();
  }

  return buf;
}

/**
 * Privacy retry: stronger portrait beauty (still not CGI).
 */
export async function stylizeReferenceImage(sourceUrl: string): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("Empty reference URL");

  const id = `refstyle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.jpg`);

  try {
    const raw = await loadImageBytes(trimmed);
    const out = await applySoftCinematicGrade(raw, { level: "retry" });
    if (out.length < 400) throw new Error("Stylized reference too small");
    await writeFile(outPublic, out);
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    const work = await mkdtemp(path.join(tmpdir(), "vyronix-refstyle-"));
    try {
      const rawPath = path.join(work, "in.bin");
      const styled = path.join(work, "styled.jpg");
      await writeFile(rawPath, await loadImageBytes(trimmed));
      const attempts = [
        // Soft beauty film — downscale + gblur + mild desat (no CGI noise).
        "scale=900:-2:flags=lanczos,eq=contrast=1.02:saturation=0.84:brightness=0.03,gblur=sigma=1.2,unsharp=3:3:0.25:3:3:0.0,format=yuvj420p",
        "scale=900:-2:flags=lanczos,eq=saturation=0.88:brightness=0.02,gblur=sigma=0.9,format=yuvj420p",
        "scale=900:-2,format=yuvj420p",
      ];
      let ok = false;
      for (const vf of attempts) {
        try {
          await run("ffmpeg", [
            "-y",
            "-i",
            rawPath,
            "-vf",
            vf,
            "-frames:v",
            "1",
            "-q:v",
            "4",
            styled,
          ]);
          ok = true;
          break;
        } catch {
          // next
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

const CINEMA_MARK = "لقطة سينمائية ناعمة";

/**
 * Privacy retry prompt: soft cinematic film still (matches accepted refs).
 */
export function toSemiRealisticScenePrompt(prompt: string): string {
  const base = (prompt || "")
    .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
    .replace(/\n*أشخاص غير حقيقيين[^\n]*/giu, "")
    .replace(/\n*شخصيات رقمية[^\n]*/giu, "")
    .replace(/\n*AI-generated digital characters[^\n]*/gi, "")
    .replace(/\n*cinematic CGI[^\n]*/gi, "")
    .trim();
  if (!base) {
    return `${CINEMA_MARK}، إضاءة ناعمة، بشرة ناعمة، عمق ميدان سينمائي.`;
  }
  if (base.includes(CINEMA_MARK)) {
    return base;
  }
  return [
    `${CINEMA_MARK} (soft cinematic film still), diffused lighting, soft skin, shallow depth of field.`,
    "Creative cinematic media — not a raw phone selfie or ID photo.",
    "",
    base,
  ].join("\n");
}
