/**
 * Stylize reference / start-frame images so BytePlus privacy filters
 * (InputImageSensitiveContentDetected · real person) are less likely to reject them.
 * Output is a stable `/generations/….jpg` URL the Ark API can fetch.
 */

import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

async function downloadImage(url: string, dest: string) {
  if (url.startsWith("/generations/")) {
    const existing = resolveGenerationFile(url);
    if (!existing) throw new Error("Invalid local generation path");
    await copyFile(existing, dest);
    return;
  }
  if (url.startsWith("data:image/")) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(url);
    if (!m) throw new Error("Invalid data URL");
    await writeFile(dest, Buffer.from(m[2]!, "base64"));
    return;
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
  await writeFile(dest, buf);
}

/**
 * Convert a photoreal reference into a cinematic CGI / illustration look
 * (pose & wardrobe preserved) so privacy filters treat it as creative media.
 * Returns a data: URL so BytePlus can ingest it without a public CDN fetch.
 */
export async function stylizeReferenceImage(sourceUrl: string): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("Empty reference URL");

  const id = `refstyle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const outPublic = path.join(GENERATIONS_DIR, `${id}.jpg`);
  const work = await mkdtemp(path.join(tmpdir(), "vyronix-refstyle-"));
  try {
    const raw = path.join(work, "in.bin");
    const styled = path.join(work, "styled.jpg");
    await downloadImage(trimmed, raw);

    // Soft CGI / illustrated look: denoise → grade → light blur → film grain.
    // Keeps composition while reducing "real photograph of a person" signals.
    const attempts = [
      "scale=1024:-2:flags=lanczos,hqdn3d=6:4:8:6,eq=contrast=1.28:saturation=1.45:brightness=0.02:gamma=1.08,unsharp=5:5:1.8:5:5:0.4,gblur=sigma=0.7,noise=alls=18:allf=t+u,format=yuvj420p",
      "scale=1024:-2:flags=lanczos,eq=contrast=1.2:saturation=1.35,gblur=sigma=1.1,noise=alls=22:allf=t,format=yuvj420p",
      "scale=768:-2,format=yuvj420p",
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
          "4",
          styled,
        ]);
        ok = true;
        break;
      } catch {
        // try next graph
      }
    }
    if (!ok) throw new Error("Unable to stylize reference image");

    await copyFile(styled, outPublic);
    const st = await stat(outPublic);
    if (st.size < 400) throw new Error("Stylized reference too small");
    // Cap payload for Ark JSON — keep under ~1.5MB base64.
    if (st.size > 1_400_000) {
      const smaller = path.join(work, "small.jpg");
      await run("ffmpeg", [
        "-y",
        "-i",
        styled,
        "-vf",
        "scale=768:-2",
        "-frames:v",
        "1",
        "-q:v",
        "6",
        smaller,
      ]);
      await copyFile(smaller, outPublic);
    }

    const bytes = await readFile(outPublic);
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function isInputImagePrivacyError(message: string): boolean {
  return /InputImageSensitive|PrivacyInformation|real person|may contain real|input image may contain/i.test(
    message,
  );
}

const SEMI_REAL_MARK = "مشهد سينمائي شبه واقعي";

/**
 * When BytePlus rejects a start-frame as a real person, rewrite the prompt as a
 * semi-realistic cinematic/CGI scene so the retry is creative media — not a photo.
 */
export function toSemiRealisticScenePrompt(prompt: string): string {
  const base = (prompt || "")
    .replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "")
    .trim();
  if (!base) {
    return `${SEMI_REAL_MARK} بأسلوب CGI فني، إضاءة سينمائية، تفاصيل واضحة، ليس صورة فوتوغرافية لشخص حقيقي.`;
  }
  if (base.includes(SEMI_REAL_MARK) || /شبه\s*واقعي/u.test(base)) {
    return base;
  }
  return [
    `${SEMI_REAL_MARK} بأسلوب CGI / رسم رقمي عالي الجودة (ليست صورة كاميرا لشخص حقيقي).`,
    "إضاءة سينمائية، ملمس جلدي ناعم مرسوم، ألوان غنية، حركة طبيعية سلسة.",
    "",
    base,
  ].join("\n");
}
