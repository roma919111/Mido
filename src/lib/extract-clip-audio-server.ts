/**
 * Server-side clip audio extraction (ffmpeg) for dialogue transcription.
 */

import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { isAllowedMediaHost } from "@/lib/media-proxy";
import { resolveHistoryVideoUrl } from "@/lib/resolve-history-url";
import { resolveGenerationFile } from "@/lib/veronix-outro";
import { serverFfmpegEnabled } from "@/lib/server-load-policy";

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
  if (url.startsWith("/generations/")) {
    const existing = resolveGenerationFile(url);
    if (!existing) throw new Error("Invalid local generation path");
    const { copyFile } = await import("node:fs/promises");
    await copyFile(existing, dest);
    return;
  }
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "video/mp4,video/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; VyronixTranscribe/1.0; +https://vyronix.app)",
      Referer: "https://vyronix.app/",
    },
  });
  if (!res.ok) throw new Error(`Video download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error("Video file too small");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(dest, buf);
}

/** Resolve a direct MP4 URL (CDN or local generations path) for server ffmpeg. */
export async function resolveClipVideoSource(input: {
  videoUrl?: string;
  historyId?: string;
}): Promise<string | null> {
  const historyId = input.historyId?.trim();
  if (historyId) {
    const fromHistory = await resolveHistoryVideoUrl(historyId);
    if (fromHistory) return fromHistory;
  }

  const raw = input.videoUrl?.trim() || "";
  if (!raw) return null;

  if (raw.startsWith("/generations/")) {
    const file = resolveGenerationFile(raw);
    return file ? raw : null;
  }

  if (raw.startsWith("/api/media/stream") || raw.startsWith("http")) {
    try {
      const base =
        raw.startsWith("http") ? undefined : "https://vyronix.app";
      const parsed = new URL(raw, base);
      const local = parsed.searchParams.get("local")?.trim();
      if (local?.startsWith("/generations/")) {
        return resolveGenerationFile(local) ? local : null;
      }
      const hid = parsed.searchParams.get("historyId")?.trim();
      if (hid) {
        const url = await resolveHistoryVideoUrl(hid);
        if (url) return url;
      }
      const encoded = parsed.searchParams.get("u")?.trim();
      if (encoded) {
        const decoded = Buffer.from(encoded, "base64url").toString("utf8");
        const u = new URL(decoded);
        if (isAllowedMediaHost(u.hostname)) return decoded;
      }
    } catch {
      // fall through
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (isAllowedMediaHost(u.hostname)) return raw;
    } catch {
      return null;
    }
  }

  return null;
}

export async function extractClipAudioFromSource(
  sourceUrl: string,
  trimStart = 0,
  playDurationSec = 0,
): Promise<{ buffer: Buffer; mimeType: string; durationSec: number } | null> {
  if (!serverFfmpegEnabled()) {
    return null;
  }
  const dir = await mkdtemp(path.join(tmpdir(), "vx-audio-"));
  const inPath = path.join(dir, "clip-in.mp4");
  const outPath = path.join(dir, "clip-audio.wav");

  try {
    await downloadToFile(sourceUrl, inPath);
    const start = Math.max(0, trimStart);
    const dur = Math.max(0.1, playDurationSec);

    const attempts: string[][] = [
      [
        "-y",
        "-ss",
        String(start),
        "-t",
        String(dur),
        "-i",
        inPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        outPath,
      ],
      [
        "-y",
        "-i",
        inPath,
        "-ss",
        String(start),
        "-t",
        String(dur),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        outPath,
      ],
      [
        "-y",
        "-i",
        inPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        outPath,
      ],
    ];

    let wav: Buffer | null = null;
    for (const args of attempts) {
      try {
        await run("ffmpeg", args);
        const data = await readFile(outPath);
        if (data.length > 44) {
          wav = data;
          break;
        }
      } catch {
        // try next ffmpeg strategy
      }
    }

    if (!wav) return null;
    return { buffer: wav, mimeType: "audio/wav", durationSec: dur };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
