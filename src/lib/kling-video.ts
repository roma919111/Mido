/**
 * Kling 3.0 Omni — direct video generation via Kling API.
 * https://kling.ai/document-api/api/video/3-0-omni/video-omni
 */

import {
  KLING_JOB_TIMEOUT_MS,
  KLING_OMNI_MODEL_ID,
  KLING_POLL_INTERVAL_MS,
  KLING_TASK_PREFIX,
  type KlingOmniQuality,
} from "@/lib/kling-constants";
import {
  clampKlingOmniDuration,
  normalizeKlingOmniQuality,
} from "@/lib/kling-pricing";
import { ensurePlainRefUrl } from "@/lib/byteplus-ark";
import { saveLocalVideo } from "@/lib/local-media";
import type { VisualReference } from "@/lib/types";

export { KLING_OMNI_MODEL_ID, KLING_TASK_PREFIX };

const DEFAULT_BASE = "https://api-singapore.klingai.com";

type KlingContentItem =
  | { type: "prompt"; text: string }
  | {
      type: "first_frame" | "last_frame" | "refer_image";
      url: string;
      id?: string;
    }
  | {
      type: "feature_video" | "base_video";
      url: string;
      id?: string;
    };

type KlingTaskStatus = "submitted" | "processing" | "succeeded" | "failed";

type KlingTaskOutput = {
  type?: string;
  url?: string;
  watermark_url?: string;
  duration?: string;
};

type KlingTaskData = {
  id?: string;
  status?: KlingTaskStatus | string;
  message?: string;
  outputs?: KlingTaskOutput[];
};

type KlingApiResponse<T> = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
};

export function getKlingApiKey(): string | undefined {
  return process.env.KLING_API_KEY?.trim() || undefined;
}

export function getKlingBaseUrl(): string {
  return (
    process.env.KLING_API_BASE_URL?.trim()?.replace(/\/+$/, "") || DEFAULT_BASE
  );
}

export function isKlingVideoConfigured(): boolean {
  return Boolean(getKlingApiKey());
}

export function toKlingHistoryId(taskId: string): string {
  return `${KLING_TASK_PREFIX}${taskId}`;
}

export function parseKlingHistoryId(
  historyId: string | null | undefined,
): string | null {
  if (!historyId?.startsWith(KLING_TASK_PREFIX)) return null;
  const id = historyId.slice(KLING_TASK_PREFIX.length).trim();
  return id || null;
}

function klingHeaders(): HeadersInit {
  const key = getKlingApiKey();
  if (!key) throw new Error("KLING_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function klingFetch<T>(
  pathname: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${getKlingBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      ...klingHeaders(),
      ...(init.headers || {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  let data: KlingApiResponse<T>;
  try {
    data = JSON.parse(text) as KlingApiResponse<T>;
  } catch {
    throw new Error(
      `Kling HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`,
    );
  }

  if (!res.ok || (typeof data.code === "number" && data.code !== 0)) {
    const msg =
      data.message ||
      text.slice(0, 240) ||
      res.statusText ||
      "Kling API error";
    throw new Error(`Kling API ${res.status}: ${msg}`);
  }

  return data.data as T;
}

function toKlingApiResolution(quality: KlingOmniQuality): "720p" | "1080p" | "4k" {
  return quality;
}

function normalizeKlingAspectRatio(raw?: string | null): "16:9" | "9:16" | "1:1" {
  const r = String(raw || "16:9").trim();
  if (r === "9:16" || r === "1:1") return r;
  return "16:9";
}

async function resolvePublicMediaUrl(
  ref: VisualReference | null | undefined,
): Promise<string | null> {
  const resolved = await ensurePlainRefUrl(ref);
  if (!resolved) return null;
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (base && resolved.startsWith("/")) {
    return `${base}${resolved}`;
  }
  return resolved;
}

export type KlingCreateVideoInput = {
  prompt: string;
  durationSec?: number;
  resolution?: string | null;
  aspectRatio?: string | null;
  generateAudio?: boolean;
  startFrame?: VisualReference | null;
  endFrame?: VisualReference | null;
  referenceImages?: VisualReference[];
};

export async function createKlingOmniVideoTask(
  input: KlingCreateVideoInput,
): Promise<{ taskId: string }> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required for Kling video");

  const duration = clampKlingOmniDuration(input.durationSec);
  const quality = normalizeKlingOmniQuality(input.resolution);
  const resolution = toKlingApiResolution(quality);
  const aspectRatio = normalizeKlingAspectRatio(input.aspectRatio);

  const contents: KlingContentItem[] = [{ type: "prompt", text: prompt }];

  const startUrl = await resolvePublicMediaUrl(input.startFrame);
  const endUrl = await resolvePublicMediaUrl(input.endFrame);
  if (startUrl) {
    contents.push({ type: "first_frame", url: startUrl, id: "image_1" });
  }
  if (endUrl) {
    contents.push({ type: "last_frame", url: endUrl, id: "image_2" });
  }

  const refList = (input.referenceImages || []).slice(0, 6);
  let refIndex = startUrl ? 2 : 1;
  for (const ref of refList) {
    const url = await resolvePublicMediaUrl(ref);
    if (!url) continue;
    contents.push({
      type: startUrl ? "refer_image" : refIndex === 1 ? "first_frame" : "refer_image",
      url,
      id: `image_${refIndex}`,
    });
    refIndex += 1;
  }

  const data = await klingFetch<{ id?: string; status?: string }>(
    "/omni-video/kling-3.0-omni",
    {
      method: "POST",
      json: {
        contents,
        settings: {
          resolution,
          duration,
          aspect_ratio: aspectRatio,
          audio: input.generateAudio ? "native" : "off",
          multi_shot: false,
        },
      },
    },
  );

  const taskId = String(data?.id || "").trim();
  if (!taskId) throw new Error("Kling did not return a task id");
  return { taskId };
}

export type KlingVideoTask = {
  status: "RUNNING" | "COMPLETED" | "FAILED";
  remoteUrl?: string;
  error?: string;
};

function mapKlingStatus(raw?: string | null): KlingVideoTask["status"] {
  const s = String(raw || "").toLowerCase();
  if (s === "succeeded") return "COMPLETED";
  if (s === "failed") return "FAILED";
  return "RUNNING";
}

function extractKlingVideoUrl(outputs?: KlingTaskOutput[]): string | undefined {
  for (const item of outputs || []) {
    if (item.type === "video" && item.url) return item.url;
  }
  const first = outputs?.find((o) => o.url);
  return first?.url;
}

export async function getKlingVideoTask(taskId: string): Promise<KlingVideoTask> {
  const data = await klingFetch<KlingTaskData[]>(
    `/tasks?task_ids=${encodeURIComponent(taskId)}`,
    { method: "GET" },
  );
  const task = Array.isArray(data) ? data[0] : undefined;
  const status = mapKlingStatus(task?.status);
  const remoteUrl = extractKlingVideoUrl(task?.outputs);
  return {
    status,
    remoteUrl,
    error: status === "FAILED" ? task?.message || "Kling video generation failed" : undefined,
  };
}

export async function downloadKlingVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl, {
    redirect: "follow",
    headers: { Accept: "video/*", "User-Agent": "VyronixKling/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Kling video download failed (${res.status})`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) {
    throw new Error("Kling returned an empty video file");
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const { localPath } = await saveLocalVideo({
    bytes,
    contentType,
    prefix: "kling",
  });
  return localPath;
}

export async function resolveKlingVideoUrl(taskId: string): Promise<string | null> {
  const task = await getKlingVideoTask(taskId);
  if (task.status !== "COMPLETED" || !task.remoteUrl) return null;
  return downloadKlingVideo(task.remoteUrl);
}

export type KlingRecoverInput = {
  userId: string;
  assetId: string;
  historyId: string;
  hidden?: boolean;
  mode?: string | null;
};

export async function tryRecoverKlingAsset(
  input: KlingRecoverInput,
): Promise<"completed" | "failed" | "pending"> {
  const klId = parseKlingHistoryId(input.historyId);
  if (!klId) return "pending";

  const task = await getKlingVideoTask(klId);
  if (task.status === "COMPLETED" && task.remoteUrl) {
    const { updateAsset } = await import("@/lib/db");
    const { warmVideoPosterBackground } = await import("@/lib/poster-cache");
    const localPath = await downloadKlingVideo(task.remoteUrl);
    await updateAsset(input.assetId, input.userId, {
      historyId: input.historyId,
      url: localPath,
      status: "completed",
      error: undefined,
      hidden: input.mode === "sequence-part" ? true : false,
    });
    warmVideoPosterBackground({ url: localPath, historyId: input.historyId });
    console.info(`[veronix] kling recovered ${klId} → ${localPath}`);
    return "completed";
  }
  if (task.status === "FAILED") return "failed";
  return "pending";
}

export async function waitForKlingVideoTask(
  taskId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ localPath: string; remoteUrl: string }> {
  const timeoutMs = options?.timeoutMs ?? KLING_JOB_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? KLING_POLL_INTERVAL_MS;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const task = await getKlingVideoTask(taskId);
    if (task.status === "COMPLETED" && task.remoteUrl) {
      const localPath = await downloadKlingVideo(task.remoteUrl);
      return { localPath, remoteUrl: task.remoteUrl };
    }
    if (task.status === "FAILED") {
      throw new Error(task.error || "Kling video generation failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Kling video generation timed out");
}

export type KlingJobFinalizeInput = {
  taskId: string;
  historyId: string;
  assetId: string;
  userId: string;
};

const klingFinalizeInflight = new Set<string>();

export async function finalizeKlingVideoJob(
  input: KlingJobFinalizeInput,
): Promise<void> {
  if (klingFinalizeInflight.has(input.taskId)) return;
  klingFinalizeInflight.add(input.taskId);

  const { updateAsset } = await import("@/lib/db");
  const { refundFailedAssetCredits } = await import("@/lib/credit-refund");
  const { warmVideoPosterBackground } = await import("@/lib/poster-cache");

  try {
    const finished = await waitForKlingVideoTask(input.taskId);
    await updateAsset(input.assetId, input.userId, {
      historyId: input.historyId,
      url: finished.localPath,
      status: "completed",
      error: undefined,
    });
    warmVideoPosterBackground({
      url: finished.localPath,
      historyId: input.historyId,
    });
    console.info(
      `[veronix] kling job done ${input.taskId} → ${finished.localPath}`,
    );
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message.includes("Kling")
          ? error.message
          : `Kling: ${error.message}`
        : "فشل توليد Kling 3.0 Omni";
    await refundFailedAssetCredits({
      userId: input.userId,
      assetId: input.assetId,
      errorMessage: msg,
    });
    await updateAsset(input.assetId, input.userId, {
      status: "failed",
      error: msg,
    }).catch(() => null);
    console.error(
      `[veronix] kling job failed ${input.taskId}:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    klingFinalizeInflight.delete(input.taskId);
  }
}
