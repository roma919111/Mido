/**
 * BytePlus ModelArk — Seedance / Dreamina video generation.
 * Sole video provider for Veronix (seedance-2-mini). OpenArt is not used for generate.
 */

import {
  isInputImagePrivacyError,
  stylizeReferenceImage,
} from "@/lib/reference-sanitize";
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
  /** Ark image role — start frames should use first_frame */
  imageRole?: "first_frame" | "reference_image";
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

function errorTextFromCreate(data: Record<string, unknown>, status: number): string {
  const errObj = data.error as { message?: string; code?: string } | undefined;
  const msg =
    errObj?.message ||
    (typeof data.message === "string" ? data.message : null) ||
    `BytePlus create failed (${status})`;
  const code = errObj?.code || "";
  return code ? `${code}: ${msg}` : msg;
}

async function postCreateTask(payload: Record<string, unknown>) {
  const res = await fetch(`${getBytePlusBaseUrl()}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  return { res, data };
}

function buildCreatePayload(
  input: BytePlusCreateInput,
  opts?: { frameUrl?: string | null; imageRole?: string; generateAudio?: boolean },
): Record<string, unknown> {
  const frameUrl =
    opts?.frameUrl !== undefined ? opts.frameUrl : input.startFrameUrl;
  const content: ContentPart[] = [{ type: "text", text: input.prompt }];
  if (frameUrl) {
    content.push({
      type: "image_url",
      image_url: { url: frameUrl },
      // Seedance i2v expects first_frame for the opening still.
      role: opts?.imageRole || input.imageRole || "first_frame",
    });
  }
  const duration = Math.max(4, Math.min(12, Math.round(input.duration)));
  const body: Record<string, unknown> = {
    model: getBytePlusModelId(),
    content,
    generate_audio:
      opts?.generateAudio !== undefined
        ? opts.generateAudio
        : Boolean(input.generateAudio),
    ratio: input.ratio || "16:9",
    duration,
    watermark: input.watermark === true,
  };
  if (input.resolution) body.resolution = input.resolution;
  return body;
}

export async function createBytePlusVideoTask(
  input: BytePlusCreateInput,
): Promise<BytePlusTask> {
  let payload = buildCreatePayload(input);
  let { res, data } = await postCreateTask(payload);

  // Retry without resolution if the Ark build rejects the field.
  if (!res.ok && input.resolution) {
    const msg = errorTextFromCreate(data, res.status);
    if (/resolution|unknown|invalid|not support/i.test(msg) || res.status === 400) {
      const { resolution: _drop, ...rest } = payload;
      payload = rest;
      ({ res, data } = await postCreateTask(payload));
    }
  }

  // Sensitive-audio rejects are common — retry once muted so the clip still lands.
  if (!res.ok && payload.generate_audio === true) {
    const msg = errorTextFromCreate(data, res.status);
    if (/OutputAudioSensitive|AudioSensitive/i.test(msg)) {
      payload = { ...payload, generate_audio: false };
      ({ res, data } = await postCreateTask(payload));
    }
  }

  // Real-person privacy block on the start frame — stylize creatively and retry.
  if (!res.ok && input.startFrameUrl) {
    const msg = errorTextFromCreate(data, res.status);
    if (isInputImagePrivacyError(msg)) {
      try {
        const styled = await stylizeReferenceImage(input.startFrameUrl);
        payload = buildCreatePayload(input, {
          frameUrl: styled,
          imageRole: "first_frame",
          generateAudio: Boolean(payload.generate_audio),
        });
        ({ res, data } = await postCreateTask(payload));
        // Last resort: keep motion from the prompt only (no still).
        if (!res.ok && isInputImagePrivacyError(errorTextFromCreate(data, res.status))) {
          payload = buildCreatePayload(input, {
            frameUrl: null,
            generateAudio: Boolean(payload.generate_audio),
          });
          ({ res, data } = await postCreateTask(payload));
        }
      } catch (styleErr) {
        console.warn(
          "[veronix] reference stylize failed:",
          styleErr instanceof Error ? styleErr.message : styleErr,
        );
      }
    }
  }

  if (!res.ok) {
    throw new Error(errorTextFromCreate(data, res.status));
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function taskErrorText(task: BytePlusTask): string {
  if (typeof task.error === "string") return task.error;
  if (task.error && typeof task.error === "object") {
    return String(task.error.message || task.error.code || "");
  }
  return "";
}

/**
 * Poll a BytePlus task until it has a video URL, fails, or times out.
 * Retries once for sensitive-audio and for real-person image privacy blocks.
 */
export async function waitForBytePlusVideoTask(
  taskId: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    /** Original create input — needed for mute / privacy retries */
    retryInput?: BytePlusCreateInput;
  },
): Promise<BytePlusTask> {
  const timeoutMs = options?.timeoutMs ?? 240_000;
  const intervalMs = options?.intervalMs ?? 5_000;
  const started = Date.now();
  let currentId = taskId;
  let mutedRetryUsed = false;
  let privacyRetryUsed = false;

  while (Date.now() - started < timeoutMs) {
    const task = await getBytePlusVideoTask(currentId);
    const status = mapBytePlusStatus(task.status);
    if (status === "COMPLETED" && task.content?.video_url) {
      return task;
    }
    if (status === "FAILED") {
      const err = taskErrorText(task);
      if (
        !mutedRetryUsed &&
        options?.retryInput &&
        /OutputAudioSensitive|AudioSensitive/i.test(err)
      ) {
        mutedRetryUsed = true;
        const retry = await createBytePlusVideoTask({
          ...options.retryInput,
          generateAudio: false,
        });
        currentId = retry.id;
        continue;
      }
      if (
        !privacyRetryUsed &&
        options?.retryInput?.startFrameUrl &&
        isInputImagePrivacyError(err)
      ) {
        privacyRetryUsed = true;
        try {
          const styled = await stylizeReferenceImage(
            options.retryInput.startFrameUrl,
          );
          const retry = await createBytePlusVideoTask({
            ...options.retryInput,
            startFrameUrl: styled,
            imageRole: "first_frame",
          });
          currentId = retry.id;
          continue;
        } catch {
          // Fall through — return original failure.
        }
      }
      return task;
    }
    await sleep(intervalMs);
  }

  return getBytePlusVideoTask(currentId);
}
