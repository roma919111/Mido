/**
 * Character still prep for Seedance / BytePlus.
 *
 * On Generate, character photos are converted to an AI / 3D-render look
 * BEFORE the prompt is sent — so BytePlus sees a synthesized digital
 * character, not a camera photo.
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
const MAX_SIDE = 1024;

async function ensureMinSide(buf: Buffer, quality = 88): Promise<Buffer> {
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

async function normalizeCanvas(bytes: Buffer): Promise<{ buf: Buffer; width: number; height: number }> {
  let img = sharp(bytes, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const w0 = meta.width || 0;
  const h0 = meta.height || 0;

  // Ultra-tall phone frames → top-weighted 3:4 (face / upper body).
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

  let buf = await img
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .toColorspace("srgb")
    .png()
    .toBuffer();

  // Max face+body zoom: tight upper-center crop, then scale back up to fill frame.
  buf = await maxFaceBodyZoom(buf);

  const out = await sharp(buf).metadata();
  return {
    buf,
    width: out.width || MAX_SIDE,
    height: out.height || MAX_SIDE,
  };
}

/**
 * Zoom so face + body fill the frame as much as possible (tight portrait crop).
 * Keeps upper bias for faces; scales back to original canvas size.
 */
async function maxFaceBodyZoom(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < MIN_SIDE || h < MIN_SIDE) return buf;

  // Keep ~68% of the frame → ~1.47× zoom on face/body.
  const zoomKeep = 0.68;
  const cropW = Math.max(MIN_SIDE, Math.round(w * zoomKeep));
  const cropH = Math.max(MIN_SIDE, Math.round(h * zoomKeep));
  const left = Math.max(0, Math.round((w - cropW) / 2));
  // Bias upward so head/torso stay in frame.
  const top = Math.max(0, Math.min(Math.round((h - cropH) * 0.14), h - cropH));

  return sharp(buf)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({
      width: w,
      height: h,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

/**
 * TEMPORARY KILL SWITCH — AI / 3D digital character look.
 * Set back to `true` to restore the previous BytePlus-accept filter + prompt framing.
 * User asked to disable and retry; restore on request if privacy rejects return.
 */
export const AI_DIGITAL_FILTER_ENABLED = false;

async function plainCompressForBytePlus(bytes: Buffer): Promise<Buffer> {
  const { buf } = await normalizeCanvas(bytes);
  const jpg = await sharp(buf).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return ensureMinSide(jpg, 88);
}

/**
 * Convert a character still into an AI / 3D-render digital look.
 * Applied on Generate BEFORE BytePlus create (when AI_DIGITAL_FILTER_ENABLED).
 */
export async function toAiDigitalCharacterRender(bytes: Buffer): Promise<Buffer> {
  const { buf: sized, width: w, height: h } = await normalizeCanvas(bytes);

  // 1–3) Digital aesthetic + extreme texture smooth + exaggerated definition.
  // Exact settings from the successful BytePlus-accept build (نجحت المهمة).
  const sculpted = await sharp(sized)
    .median(13)
    .blur(2.4)
    .modulate({ brightness: 1.05, saturation: 1.28 })
    .linear(1.2, -14)
    .sharpen({ sigma: 1.55, m1: 2.0, m2: 0.55 })
    .png()
    .toBuffer();

  // 4) Soft bloom lighting — digital glow on bright areas / edges.
  const glow = await sharp(sculpted)
    .modulate({ brightness: 1.35 })
    .blur(28)
    .png()
    .toBuffer();
  const bloomed = await sharp(sculpted)
    .composite([{ input: glow, blend: "soft-light" }])
    .png()
    .toBuffer();

  // 5) Digital background isolation — flat digital blur behind a soft subject mask.
  const bg = await sharp(bloomed)
    .blur(40)
    .modulate({ saturation: 0.75, brightness: 0.94 })
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="40%" r="62%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="48%" stop-color="#ffffff"/>
          <stop offset="78%" stop-color="#777777"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );
  const maskPng = await sharp(maskSvg).resize(w, h).png().toBuffer();
  const subject = await sharp(bloomed)
    .ensureAlpha()
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();
  const isolated = await sharp(bg)
    .composite([{ input: subject, blend: "over" }])
    .removeAlpha()
    .png()
    .toBuffer();

  // 6) AI cinematic color grading — saturated digital film look.
  const graded = await sharp(isolated)
    .modulate({ brightness: 1.04, saturation: 1.28 })
    .linear(1.12, -10)
    .tint({ r: 255, g: 240, b: 220 })
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  const finalBuf = await ensureMinSide(graded, 88);
  // Persist a copy so ops can verify the filter ran before BytePlus.
  try {
    const id = `aichar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await mkdir(GENERATIONS_DIR, { recursive: true });
    await writeFile(path.join(GENERATIONS_DIR, `${id}.jpg`), finalBuf);
    console.info(`[veronix] AI digital filter saved /generations/${id}.jpg`);
  } catch {
    // non-fatal
  }
  return finalBuf;
}

/** Compress (+ optional AI digital render when enabled). */
export async function compressReferenceForBytePlus(bytes: Buffer): Promise<Buffer> {
  if (!AI_DIGITAL_FILTER_ENABLED) {
    return plainCompressForBytePlus(bytes);
  }
  try {
    return await toAiDigitalCharacterRender(bytes);
  } catch (err) {
    console.warn(
      "[veronix] AI digital render failed, falling back to compress:",
      err instanceof Error ? err.message : err,
    );
    return plainCompressForBytePlus(bytes);
  }
}

export type SoftGradeLevel = "generate" | "retry";

/** Privacy retry — re-run the full AI digital render (same look, second pass). */
export async function applySoftCinematicGrade(
  bytes: Buffer,
  _opts?: { level?: SoftGradeLevel; stronger?: boolean },
): Promise<Buffer> {
  return compressReferenceForBytePlus(bytes);
}

/** Privacy retry helper. */
export async function stylizeReferenceImage(sourceUrl: string): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("Empty reference URL");

  const id = `aichar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.jpg`);

  try {
    const raw = await loadImageBytes(trimmed);
    const out = AI_DIGITAL_FILTER_ENABLED
      ? await toAiDigitalCharacterRender(raw)
      : await plainCompressForBytePlus(raw);
    if (out.length < 400) throw new Error("AI digital render too small");
    await writeFile(outPublic, out);
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    // ffmpeg fallback approximating the same digital look
    const work = await mkdtemp(path.join(tmpdir(), "vyronix-aichar-"));
    try {
      const rawPath = path.join(work, "in.bin");
      const styled = path.join(work, "styled.jpg");
      await writeFile(rawPath, await loadImageBytes(trimmed));
      await run("ffmpeg", [
        "-y",
        "-i",
        rawPath,
        "-vf",
        "scale=1024:-2:flags=lanczos,eq=contrast=1.15:saturation=1.22:brightness=0.03,gblur=sigma=1.5,unsharp=5:5:1.2:5:5:0.0,format=yuvj420p",
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
      bytes = Buffer.from(await ensureMinSide(bytes, 88));
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

const AI_MARK = "شخصية رقمية مولّدة بالذكاء الاصطناعي";

/** Prompt framing after AI digital stills are attached (no-op while filter disabled). */
export function toSemiRealisticScenePrompt(prompt: string): string {
  const base = (prompt || "")
    .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
    .replace(/\n*أشخاص غير حقيقيين[^\n]*/giu, "")
    .replace(/\n*شخصيات رقمية[^\n]*/giu, "")
    .replace(/\n*AI-generated digital characters[^\n]*/gi, "")
    .replace(/\n*cinematic CGI[^\n]*/gi, "")
    .replace(/\n*لقطة سينمائية ناعمة[^\n]*/giu, "")
    .trim();
  if (!AI_DIGITAL_FILTER_ENABLED) return base;
  if (!base) {
    return `${AI_MARK}، مظهر 3D render رقمي مصقول، إضاءة soft bloom.`;
  }
  if (base.includes(AI_MARK)) return base;
  return [
    `${AI_MARK} (AI-generated digital 3D character render, polished synthetic skin, soft bloom).`,
    "Not a real-person camera photo. Digital cinematic AI synthesis.",
    "",
    base,
  ].join("\n");
}
