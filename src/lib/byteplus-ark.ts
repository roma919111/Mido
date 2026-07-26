/**
 * BytePlus ModelArk — Seedance / Dreamina video generation.
 * Sole video provider for Veronix (seedance-2-mini). OpenArt is not used for generate.
 */

import type { VisualReference } from "@/lib/types";

export const BYTEPLUS_TASK_PREFIX = "bp:";

const DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";
const DEFAULT_MODEL = "dreamina-seedance-2-0-mini-260615";

export function getBytePlusApiKey(): string | undefined {
  return (
    process.env.BYTEPLUS_API_KEY?.trim() ||
    process.env.ARK_API_KEY?.trim() ||
    undefined
  );
}

export function getBytePlusBaseUrl(): string {
  let raw =
    process.env.BYTEPLUS_ARK_BASE_URL?.trim() ||
    process.env.ARK_BASE_URL?.trim() ||
    DEFAULT_BASE;
  raw = raw.replace(/\/+$/, "");
  // Accept host-only env values and normalize to /api/v3.
  if (!/\/api\/v\d+$/i.test(raw)) {
    raw = `${raw}/api/v3`;
  }
  return raw;
}

export function getBytePlusModelId(): string {
  return (
    process.env.BYTEPLUS_VIDEO_MODEL?.trim() ||
    process.env.ARK_VIDEO_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

export function isBytePlusConfigured(): boolean {
  return Boolean(getBytePlusApiKey());
}

export function toBytePlusHistoryId(taskId: string): string {
  return `${BYTEPLUS_TASK_PREFIX}${taskId}`;
}

export function parseBytePlusHistoryId(historyId: string): string | null {
  if (!historyId.startsWith(BYTEPLUS_TASK_PREFIX)) return null;
  const id = historyId.slice(BYTEPLUS_TASK_PREFIX.length).trim();
  return id || null;
}

type ContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string };
      role?: string;
    };

export type BytePlusCreateInput = {
  prompt: string;
  duration: number;
  ratio?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  /** Absolute http(s) or data: URL for first-frame / reference */
  startFrameUrl?: string | null;
  resolution?: string;
};

export type BytePlusTask = {
  id: string;
  status: string;
  model?: string;
  content?: {
    video_url?: string;
    last_frame_url?: string;
  };
  error?: { code?: string; message?: string } | string;
  raw: Record<string, unknown>;
};

function authHeaders(): HeadersInit {
  const key = getBytePlusApiKey();
  if (!key) throw new Error("BYTEPLUS_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { rawText: text, status: res.status };
  }
}

/** Prefer a URL BytePlus can fetch (https or data). */
export function resolvePublicMediaUrl(
  ref: VisualReference | null | undefined,
): string | null {
  if (!ref?.url?.trim()) return null;
  const url = ref.url.trim();
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("data:image/")) return url;
  const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (base && url.startsWith("/")) return `${base}${url}`;
  return null;
}

export async function createBytePlusVideoTask(
  input: BytePlusCreateInput,
): Promise<BytePlusTask> {
  const content: ContentPart[] = [
    { type: "text", text: input.prompt },
  ];
  if (input.startFrameUrl) {
    content.push({
      type: "image_url",
      image_url: { url: input.startFrameUrl },
      role: "reference_image",
    });
  }

  const duration = Math.max(4, Math.min(12, Math.round(input.duration)));
  const body: Record<string, unknown> = {
    model: getBytePlusModelId(),
    content,
    generate_audio: Boolean(input.generateAudio),
    ratio: input.ratio || "16:9",
    duration,
    watermark: input.watermark === true,
  };
  async function postCreate(payload: Record<string, unknown>) {
    const res = await fetch(`${getBytePlusBaseUrl()}/contents/generations/tasks`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await parseJson(res);
    return { res, data };
  }

  let { res, data } = await postCreate(
    input.resolution ? { ...body, resolution: input.resolution } : body,
  );
  // Retry without resolution if the Ark build rejects the field.
  if (!res.ok && input.resolution) {
    const errObj = data.error as { message?: string; code?: string } | undefined;
    const msg = String(errObj?.message || data.message || "");
    if (/resolution|unknown|invalid|not support/i.test(msg) || res.status === 400) {
      ({ res, data } = await postCreate(body));
    }
  }

  if (!res.ok) {
    const errObj = data.error as { message?: string; code?: string } | undefined;
    const msg =
      errObj?.message ||
      (typeof data.message === "string" ? data.message : null) ||
      `BytePlus create failed (${res.status})`;
    const code = errObj?.code || "";
    throw new Error(code ? `${code}: ${msg}` : msg);
  }

  const id = String(data.id || data.task_id || "");
  if (!id) throw new Error("BytePlus create returned no task id");
  return {
    id,
    status: String(data.status || "queued"),
    model: typeof data.model === "string" ? data.model : undefined,
    content: (data.content as BytePlusTask["content"]) || undefined,
    raw: data,
  };
}

export async function getBytePlusVideoTask(taskId: string): Promise<BytePlusTask> {
  const res = await fetch(
    `${getBytePlusBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );
  const data = await parseJson(res);
  if (!res.ok) {
    const errObj = data.error as { message?: string; code?: string } | undefined;
    const msg =
      errObj?.message ||
      (typeof data.message === "string" ? data.message : null) ||
      `BytePlus get failed (${res.status})`;
    throw new Error(msg);
  }

  const content = (data.content || {}) as Record<string, unknown>;
  const videoUrl =
    (typeof content.video_url === "string" && content.video_url) ||
    (typeof data.video_url === "string" && data.video_url) ||
    undefined;

  return {
    id: String(data.id || taskId),
    status: String(data.status || "unknown"),
    model: typeof data.model === "string" ? data.model : undefined,
    content: {
      video_url: videoUrl,
      last_frame_url:
        typeof content.last_frame_url === "string"
          ? content.last_frame_url
          : undefined,
    },
    error: (data.error as BytePlusTask["error"]) || undefined,
    raw: data,
  };
}

/** Map Ark status → OpenArt-like uppercase for CreateStudio. */
export function mapBytePlusStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "succeeded" || s === "success" || s === "completed") return "COMPLETED";
  if (s === "failed" || s === "cancelled" || s === "canceled" || s === "expired") {
    return "FAILED";
  }
  if (s === "running" || s === "processing" || s === "generating") return "RUNNING";
  return "PENDING";
}
