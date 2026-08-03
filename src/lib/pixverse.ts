/**
 * PixVerse OpenAPI — direct video generation (v6).
 * https://docs.platform.pixverse.ai/
 */

import { resolveGenerationFile } from "@/lib/veronix-outro";
import type { VisualReference } from "@/lib/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const PIXVERSE_MODEL_ID = "pixverse-v6";
export const PIXVERSE_TASK_PREFIX = "pv:";

const DEFAULT_BASE = "https://app-api.pixverse.ai";
const DEFAULT_MODEL = "v6";

type PixVerseEnvelope<T> = {
  ErrCode: number;
  ErrMsg: string;
  Resp: T;
};

export function getPixVerseApiKey(): string | undefined {
  return process.env.PIXVERSE_API_KEY?.trim() || undefined;
}

export function getPixVerseBaseUrl(): string {
  return (
    process.env.PIXVERSE_API_BASE_URL?.trim()?.replace(/\/+$/, "") ||
    DEFAULT_BASE
  );
}

export function getPixVerseApiModel(): string {
  return process.env.PIXVERSE_VIDEO_MODEL?.trim() || DEFAULT_MODEL;
}

export function isPixVerseConfigured(): boolean {
  return Boolean(getPixVerseApiKey());
}

export function toPixVerseHistoryId(videoId: number | string): string {
  return `${PIXVERSE_TASK_PREFIX}${videoId}`;
}

export function parsePixVerseHistoryId(
  historyId: string | null | undefined,
): number | null {
  if (!historyId?.startsWith(PIXVERSE_TASK_PREFIX)) return null;
  const raw = historyId.slice(PIXVERSE_TASK_PREFIX.length).trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function traceId(): string {
  return randomUUID();
}

function assertOk<T>(data: PixVerseEnvelope<T>, context: string): T {
  if (data.ErrCode !== 0) {
    throw new Error(
      data.ErrMsg?.trim() ||
        `PixVerse ${context} failed (ErrCode ${data.ErrCode})`,
    );
  }
  return data.Resp;
}

async function pixverseRequest<T>(
  pathname: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const key = getPixVerseApiKey();
  if (!key) throw new Error("PIXVERSE_API_KEY is not configured");

  const headers = new Headers(init.headers);
  headers.set("API-KEY", key);
  headers.set("Ai-trace-id", traceId());

  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(`${getPixVerseBaseUrl()}${pathname}`, {
    ...init,
    headers,
    body,
  });

  const text = await res.text();
  let data: PixVerseEnvelope<T>;
  try {
    data = JSON.parse(text) as PixVerseEnvelope<T>;
  } catch {
    throw new Error(
      `PixVerse HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`,
    );
  }

  return assertOk(data, pathname);
}

const ALLOWED_QUALITY = new Set(["360p", "540p", "720p", "1080p"]);

export function normalizePixVerseQuality(raw?: string | null): string {
  const q = String(raw || "720p").trim().toLowerCase();
  return ALLOWED_QUALITY.has(q) ? q : "720p";
}

const ALLOWED_RATIO = new Set([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
  "2:3",
  "3:2",
]);

export function normalizePixVerseRatio(raw?: string | null): string {
  const r = String(raw || "16:9").trim();
  return ALLOWED_RATIO.has(r) ? r : "16:9";
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function readLocalGenerationBytes(
  url: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  let localPath = "";
  if (url.startsWith("/generations/")) {
    localPath = url;
  } else {
    const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
    if (base && url.startsWith(`${base}/generations/`)) {
      localPath = url.slice(base.length);
    }
  }
  if (!localPath) return null;
  const filePath = resolveGenerationFile(localPath);
  if (!filePath) return null;
  const bytes = await readFile(filePath);
  if (bytes.length < 32) return null;
  return { bytes, mime: mimeFromPath(filePath) };
}

async function readDataUrlBytes(
  url: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i.exec(url);
  if (!m?.[2]) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length < 32) return null;
  return { bytes, mime: m[1] || "image/jpeg" };
}

/** Upload still → img_id for image-to-video. */
export async function uploadPixVerseImage(
  ref: VisualReference | null | undefined,
  resolvedUrl?: string | null,
): Promise<number> {
  const url = resolvedUrl || ref?.url?.trim() || "";
  if (!url) throw new Error("صورة البداية مطلوبة لـ PixVerse (Image-to-Video).");

  const key = getPixVerseApiKey();
  if (!key) throw new Error("PIXVERSE_API_KEY is not configured");

  const headers = new Headers();
  headers.set("API-KEY", key);
  headers.set("Ai-trace-id", traceId());

  const form = new FormData();

  if (url.startsWith("http://") || url.startsWith("https://")) {
    form.append("image_url", url);
  } else {
    const data = (await readDataUrlBytes(url)) || (await readLocalGenerationBytes(url));
    if (!data) {
      throw new Error(
        "تعذّر تجهيز صورة البداية لـ PixVerse. جرّب رفع الصورة من جديد.",
      );
    }
    const ext =
      data.mime === "image/png"
        ? "png"
        : data.mime === "image/webp"
          ? "webp"
          : "jpg";
    form.append(
      "image",
      new Blob([data.bytes], { type: data.mime }),
      `start.${ext}`,
    );
  }

  const res = await fetch(`${getPixVerseBaseUrl()}/openapi/v2/image/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text();
  const data = JSON.parse(text) as PixVerseEnvelope<{ img_id?: number }>;
  const resp = assertOk(data, "image/upload");
  const imgId = Number(resp.img_id);
  if (!Number.isFinite(imgId) || imgId <= 0) {
    throw new Error("PixVerse upload did not return img_id");
  }
  return imgId;
}

export type PixVerseCreateInput = {
  prompt: string;
  duration: number;
  quality: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  imgId?: number;
};

export async function createPixVerseVideoTask(
  input: PixVerseCreateInput,
): Promise<{ videoId: number }> {
  const model = getPixVerseApiModel();
  const duration = Math.min(15, Math.max(1, Math.round(input.duration)));
  const quality = normalizePixVerseQuality(input.quality);
  const prompt = input.prompt.trim().slice(0, 5000);
  if (!prompt) throw new Error("prompt is required");

  if (input.imgId != null) {
    const resp = await pixverseRequest<{ video_id?: number }>(
      "/openapi/v2/video/img/generate",
      {
        method: "POST",
        json: {
          duration,
          img_id: input.imgId,
          model,
          prompt,
          quality,
          generate_audio_switch: Boolean(input.generateAudio),
          seed: 0,
        },
      },
    );
    const videoId = Number(resp.video_id);
    if (!Number.isFinite(videoId) || videoId <= 0) {
      throw new Error("PixVerse image-to-video did not return video_id");
    }
    return { videoId };
  }

  const resp = await pixverseRequest<{ video_id?: number }>(
    "/openapi/v2/video/text/generate",
    {
      method: "POST",
      json: {
        aspect_ratio: normalizePixVerseRatio(input.aspectRatio),
        duration,
        model,
        prompt,
        quality,
        generate_audio_switch: Boolean(input.generateAudio),
        seed: 0,
      },
    },
  );
  const videoId = Number(resp.video_id);
  if (!Number.isFinite(videoId) || videoId <= 0) {
    throw new Error("PixVerse text-to-video did not return video_id");
  }
  return { videoId };
}

export type PixVerseVideoResult = {
  status: number;
  url?: string;
  errMsg?: string;
};

export async function getPixVerseVideoTask(
  videoId: number,
): Promise<PixVerseVideoResult> {
  const resp = await pixverseRequest<{ status?: number; url?: string }>(
    `/openapi/v2/video/result/${videoId}`,
    { method: "GET" },
  );
  return {
    status: Number(resp.status ?? 5),
    url: typeof resp.url === "string" ? resp.url : undefined,
  };
}

/** 1 = done, 5 = generating, 7 = moderation, 8 = failed */
export function mapPixVerseStatus(
  status: number,
): "COMPLETED" | "RUNNING" | "FAILED" {
  if (status === 1) return "COMPLETED";
  if (status === 5) return "RUNNING";
  return "FAILED";
}

export function pixVerseFailureMessage(status: number): string {
  if (status === 7) {
    return "رفض PixVerse المحتوى (moderation). عدّل الوصف وحاول مجدداً.";
  }
  if (status === 8) {
    return "فشل توليد PixVerse. حاول مرة أخرى.";
  }
  return `PixVerse status ${status}`;
}

export async function waitForPixVerseVideoTask(
  videoId: number,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<PixVerseVideoResult & { videoId: number }> {
  const timeoutMs = options?.timeoutMs ?? 240_000;
  const intervalMs = options?.intervalMs ?? 4_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const task = await getPixVerseVideoTask(videoId);
    const mapped = mapPixVerseStatus(task.status);
    if (mapped === "COMPLETED" && task.url) {
      return { ...task, videoId };
    }
    if (mapped === "FAILED") {
      throw new Error(pixVerseFailureMessage(task.status));
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("PixVerse generation timed out");
}
