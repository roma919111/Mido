/**
 * Soft cinematic grade tuned from measured accepted vs rejected refs.
 *
 * Accepted (worked): ~496–1142px wide, normal portrait ratios, sat≈0.23
 * Rejected (privacy): consistently 1440×3120 ultra-tall phone stills
 *
 * Strategy: crop ultra-tall shots to a face-forward 3:4, match accepted
 * size band, light film desat — NOT CGI/cartoon.
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
 * Match accepted Seedance stills:
 * 1) Ultra-tall phone frames (h/w > 1.85) → top-weighted 3:4 crop (face zone)
 * 2) Long side ≤ 1100 (accepted band), both sides ≥ 320 (BytePlus min 300)
 * 3) Light film: sat≈0.9×, tiny soften — keep likeness, no CGI
 */
export async function applySoftCinematicGrade(
  bytes: Buffer,
  opts?: { level?: SoftGradeLevel; stronger?: boolean },
): Promise<Buffer> {
  const level: SoftGradeLevel =
    opts?.level || (opts?.stronger ? "retry" : "generate");
  const retry = level === "retry";

  const MAX_SIDE = retry ? 1000 : 1100;
  const MIN_SIDE = 320;

  let img = sharp(bytes).rotate();
  const meta = await img.metadata();
  const w0 = meta.width || 0;
  const h0 = meta.height || 0;

  if (w0 > 0 && h0 > 0 && h0 / w0 > 1.85) {
    // Rejected refs were 1440×3120. Crop to 3:4 from the upper body/face band.
    const targetH = Math.round(w0 * (4 / 3));
    const height = Math.min(h0, targetH);
    // Bias crop upward (faces sit in the top half of full-body phone shots).
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
    .modulate({
      brightness: retry ? 1.03 : 1.02,
      saturation: retry ? 0.88 : 0.9,
    })
    .linear(1.02, -2)
    .median(retry ? 3 : 2)
    .blur(retry ? 0.55 : 0.4)
    .sharpen({ sigma: 0.4 })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  const outMeta = await sharp(buf).metadata();
  const w = outMeta.width || 0;
  const h = outMeta.height || 0;
  if (w > 0 && h > 0 && (w < MIN_SIDE || h < MIN_SIDE)) {
    buf = await sharp(buf)
      .resize({
        width: Math.max(MIN_SIDE, w),
        height: Math.max(MIN_SIDE, h),
        fit: "outside",
        withoutEnlargement: false,
      })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
  }

  return buf;
}

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
        "scale=1100:-2:flags=lanczos,eq=saturation=0.9:brightness=0.02,gblur=sigma=0.45,format=yuvj420p",
        "scale=1100:-2,format=yuvj420p",
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
            "3",
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
      // Guarantee BytePlus min width after ffmpeg scale.
      let bytes = await readFile(outPublic);
      bytes = await applySoftCinematicGrade(bytes, { level: "retry" });
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
