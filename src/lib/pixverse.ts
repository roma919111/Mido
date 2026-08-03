/**
 * PixVerse OpenAPI — direct video generation (v6).
 * https://docs.platform.pixverse.ai/
 */

import { resolveGenerationFile } from "@/lib/veronix-outro";
import type { VisualReference } from "@/lib/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PIXVERSE_MODEL_ID as PIXVERSE_MODEL_ID_CONST,
  PIXVERSE_TASK_PREFIX as PIXVERSE_TASK_PREFIX_CONST,
} from "@/lib/pixverse-constants";

export const PIXVERSE_MODEL_ID = PIXVERSE_MODEL_ID_CONST;
export const PIXVERSE_TASK_PREFIX = PIXVERSE_TASK_PREFIX_CONST;

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

export { normalizePixVerseQuality } from "@/lib/pixverse-pricing";

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
  if (r === "auto") return "auto";
  return ALLOWED_RATIO.has(r) ? r : "16:9";
}

function mimeFromMediaPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mp4") return "video/mp4";
  return ext.startsWith(".") ? "application/octet-stream" : "image/jpeg";
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
  return { bytes, mime: mimeFromMediaPath(filePath) };
}

async function readRemoteMediaBytes(
  url: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "*/*", "User-Agent": "VyronixPixVerse/1.0" },
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 32) return null;
    const mime =
      res.headers.get("content-type")?.split(";")[0]?.trim() ||
      mimeFromMediaPath(url);
    return { bytes, mime };
  } catch {
    return null;
  }
}

async function resolveMediaBytes(
  url: string,
): Promise<{ bytes: Buffer; mime: string; filename: string }> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Media URL is empty");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const remote = await readRemoteMediaBytes(trimmed);
    if (!remote) throw new Error("تعذّر تحميل الملف المرجعي.");
    const ext = remote.mime.includes("video")
      ? remote.mime.includes("webm")
        ? "webm"
        : remote.mime.includes("quicktime")
          ? "mov"
          : "mp4"
      : remote.mime.includes("png")
        ? "png"
        : remote.mime.includes("webp")
          ? "webp"
          : "jpg";
    return { ...remote, filename: `ref.${ext}` };
  }

  const data = (await readDataUrlBytes(trimmed)) || (await readLocalGenerationBytes(trimmed));
  if (!data) {
    throw new Error("تعذّر تجهيز الملف المرجعي. جرّب الرفع من جديد.");
  }
  const ext = data.mime.includes("video")
    ? data.mime.includes("webm")
      ? "webm"
      : data.mime.includes("quicktime")
        ? "mov"
        : "mp4"
    : data.mime.includes("png")
      ? "png"
      : data.mime.includes("webp")
        ? "webp"
        : "jpg";
  return { ...data, filename: `ref.${ext}` };
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
      new Blob([Uint8Array.from(data.bytes)], { type: data.mime }),
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

/** Upload reference video → media_id for Fusion (omni). */
export async function uploadPixVerseVideo(
  ref: VisualReference | null | undefined,
  resolvedUrl?: string | null,
): Promise<number> {
  const url = resolvedUrl || ref?.url?.trim() || "";
  if (!url) throw new Error("فيديو مرجعي مطلوب لـ PixVerse Fusion.");

  const key = getPixVerseApiKey();
  if (!key) throw new Error("PIXVERSE_API_KEY is not configured");

  const media = await resolveMediaBytes(url);
  if (!media.mime.startsWith("video/")) {
    throw new Error("الملف المرجعي يجب أن يكون فيديو (MP4 / MOV / WebM).");
  }

  const headers = new Headers();
  headers.set("API-KEY", key);
  headers.set("Ai-trace-id", traceId());

  const form = new FormData();
  form.append(
    "file",
    new Blob([Uint8Array.from(media.bytes)], { type: media.mime }),
    media.filename,
  );

  const res = await fetch(`${getPixVerseBaseUrl()}/openapi/v2/media/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text();
  const data = JSON.parse(text) as PixVerseEnvelope<{ media_id?: number }>;
  const resp = assertOk(data, "media/upload");
  const mediaId = Number(resp.media_id);
  if (!Number.isFinite(mediaId) || mediaId <= 0) {
    throw new Error("PixVerse video upload did not return media_id");
  }
  return mediaId;
}

export type PixVerseFusionImageRef = {
  type: "subject" | "background";
  img_id: number;
  ref_name: string;
};

export type PixVerseFusionInput = {
  prompt: string;
  quality: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  /** Required for omni video-reference mode — duration must be 0. */
  videoMediaIds?: number[];
  imageReferences?: PixVerseFusionImageRef[];
  duration?: number;
};

export async function createPixVerseFusionTask(
  input: PixVerseFusionInput,
): Promise<{ videoId: number }> {
  const model = getPixVerseApiModel();
  const quality = normalizePixVerseQuality(input.quality);
  const prompt = input.prompt.trim().slice(0, 5000);
  if (!prompt) throw new Error("prompt is required");

  const videoIds = (input.videoMediaIds || []).filter(
    (id) => Number.isFinite(id) && id > 0,
  );
  const imageRefs = (input.imageReferences || []).slice(0, 10);
  const omniVideo = videoIds.length > 0;

  if (omniVideo && videoIds.length > 2) {
    throw new Error("PixVerse يدعم فيديوين مرجعيين كحد أقصى.");
  }
  if (!omniVideo && !imageRefs.length) {
    throw new Error("Fusion requires at least one reference image or video.");
  }

  const duration = omniVideo
    ? 0
    : Math.min(15, Math.max(1, Math.round(input.duration ?? 5)));

  const json: Record<string, unknown> = {
    model,
    prompt,
    quality,
    aspect_ratio: normalizePixVerseRatio(
      omniVideo ? input.aspectRatio || "auto" : input.aspectRatio,
    ),
    duration,
    generate_audio_switch: Boolean(input.generateAudio),
    seed: 0,
  };

  if (omniVideo) {
    json.reference_mode = "omni";
    json.video_references = videoIds.map((media_id) => ({ media_id }));
  }
  if (imageRefs.length) {
    json.image_references = imageRefs;
  }

  const resp = await pixverseRequest<{ video_id?: number }>(
    "/openapi/v2/video/fusion/generate",
    { method: "POST", json },
  );
  const videoId = Number(resp.video_id);
  if (!Number.isFinite(videoId) || videoId <= 0) {
    throw new Error("PixVerse fusion did not return video_id");
  }
  return { videoId };
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
