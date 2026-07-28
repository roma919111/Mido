/**
 * Reference image prep for Seedance / BytePlus privacy.
 *
 * Evidence from production:
 * - Accepted Dana/Khaled refs worked as near-raw uploads.
 * - After we forced a beauty grade on EVERY generate, those same refs failed.
 * - Rejected phone stills were ultra-tall 1440×3120 frames.
 *
 * Rules:
 * 1) First send: compress only (+ crop ultra-tall). No beauty/CGI filters.
 * 2) Privacy retry: light soft film grade only.
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

const MIN_SIDE = 320;
const MAX_SIDE_FIRST = 1280;
const MAX_SIDE_RETRY = 1100;

async function ensureMinSide(buf: Buffer, quality = 85): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w > 0 && h > 0 && (w < MIN_SIDE || h < MIN_SIDE)) {
    return sharp(buf)
      .resize({
        width: Math.max(MIN_SIDE, w),
        height: Math.max(MIN_SIDE, h),
        fit: "outside",
        withoutEnlargement: false,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  return buf;
}

/**
 * First-attempt prep: keep the original look (what made accepted refs pass).
 * Only crop ultra-tall phone frames, then jpeg compress.
 */
export async function compressReferenceForBytePlus(bytes: Buffer): Promise<Buffer> {
  let img = sharp(bytes).rotate();
  const meta = await img.metadata();
  const w0 = meta.width || 0;
  const h0 = meta.height || 0;

  if (w0 > 0 && h0 > 0 && h0 / w0 > 1.85) {
    const targetH = Math.round(w0 * (4 / 3));
    const height = Math.min(h0, targetH);
    const top = Math.max(0, Math.round((h0 - height) * 0.12));
    img = img.extract({
      left: 0,
      top: Math.min(top, Math.max(0, h0 - height)),
      width: w0,
      height,
    });
  }

  const buf = await img
    .resize({
      width: MAX_SIDE_FIRST,
      height: MAX_SIDE_FIRST,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return ensureMinSide(buf, 88);
}

export type SoftGradeLevel = "generate" | "retry";

/**
 * Privacy-retry only: light film soften. Never used on the first successful path.
 * @deprecated generate level — use compressReferenceForBytePlus instead.
 */
export async function applySoftCinematicGrade(
  bytes: Buffer,
  opts?: { level?: SoftGradeLevel; stronger?: boolean },
): Promise<Buffer> {
  const level: SoftGradeLevel =
    opts?.level || (opts?.stronger ? "retry" : "generate");

  // First path must stay raw-ish — do not beauty-filter accepted characters.
  if (level === "generate") {
    return compressReferenceForBytePlus(bytes);
  }

  let img = sharp(bytes).rotate();
  const meta = await img.metadata();
  const w0 = meta.width || 0;
  const h0 = meta.height || 0;
  if (w0 > 0 && h0 > 0 && h0 / w0 > 1.85) {
    const targetH = Math.round(w0 * (4 / 3));
    const height = Math.min(h0, targetH);
    const top = Math.max(0, Math.round((h0 - height) * 0.12));
    img = img.extract({
      left: 0,
      top: Math.min(top, Math.max(0, h0 - height)),
      width: w0,
      height,
    });
  }

  const buf = await img
    .resize({
      width: MAX_SIDE_RETRY,
      height: MAX_SIDE_RETRY,
      fit: "inside",
      withoutEnlargement: true,
    })
    .modulate({ brightness: 1.02, saturation: 0.92 })
    .blur(0.35)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return ensureMinSide(buf, 86);
}

/** Privacy retry helper — light soften only after BytePlus rejects. */
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
      await run("ffmpeg", [
        "-y",
        "-i",
        rawPath,
        "-vf",
        "scale=1100:-2:flags=lanczos,eq=saturation=0.92:brightness=0.015,gblur=sigma=0.35,format=yuvj420p",
        "-frames:v",
        "1",
        "-q:v",
        "3",
        styled,
      ]);
      await copyFile(styled, outPublic);
      const st = await stat(outPublic);
      if (st.size < 400) throw new Error("Stylized reference too small");
      let bytes: Buffer = await readFile(outPublic);
      bytes = Buffer.from(await ensureMinSide(bytes, 86));
      await writeFile(outPublic, bytes);
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

export function toSemiRealisticScenePrompt(prompt: string): string {
  const base = (prompt || "")
    .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
    .replace(/\n*أشخاص غير حقيقيين[^\n]*/giu, "")
    .replace(/\n*شخصيات رقمية[^\n]*/giu, "")
    .replace(/\n*AI-generated digital characters[^\n]*/gi, "")
    .replace(/\n*cinematic CGI[^\n]*/gi, "")
    .trim();
  if (!base) {
    return `${CINEMA_MARK}، إضاءة ناعمة، عمق ميدان سينمائي.`;
  }
  if (base.includes(CINEMA_MARK)) return base;
  return [
    `${CINEMA_MARK} (soft cinematic film still), diffused lighting, shallow depth of field.`,
    "Creative cinematic media — not a raw phone selfie or ID photo.",
    "",
    base,
  ].join("\n");
}
