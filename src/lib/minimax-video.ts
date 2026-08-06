/**
 * MiniMax H3 — video generation via platform API.
 * https://platform.minimax.io/docs
 * @deploy 2026-08-05
 */

import {
  MINIMAX_H3_API_MODEL,
  MINIMAX_H3_MODEL_ID,
  MINIMAX_JOB_TIMEOUT_MS,
  MINIMAX_POLL_INTERVAL_MS,
  MINIMAX_TASK_PREFIX,
  type MiniMaxH3Quality,
} from "@/lib/minimax-constants";
import {
  clampMiniMaxH3Duration,
  normalizeMiniMaxH3Quality,
} from "@/lib/minimax-pricing";
import { ensurePlainRefUrl } from "@/lib/byteplus-ark";
import { saveLocalVideo } from "@/lib/local-media";
import type { VisualReference } from "@/lib/types";

export {
  MINIMAX_H3_MODEL_ID,
  MINIMAX_H3_API_MODEL,
  MINIMAX_TASK_PREFIX,
};

const DEFAULT_BASE = "https://api.minimax.io";

type MiniMaxContentItem =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string };
      role:
        | "first_frame"
        | "last_frame"
        | "reference_image"
        | "reference_video"
        | "reference_audio";
    };

type MiniMaxTask = {
  status?: string;
  content?: { url?: string };
  error?: string | { message?: string };
};

type MiniMaxCreateResponse = {
  task_id?: string;
};

type MiniMaxQueryResponse = {
  task?: MiniMaxTask;
};

export function getMiniMaxApiKey(): string | undefined {
  return process.env.MINIMAX_API_KEY?.trim() || undefined;
}

export function getMiniMaxBaseUrl(): string {
  return (
    process.env.MINIMAX_API_BASE_URL?.trim()?.replace(/\/+$/, "") ||
    DEFAULT_BASE
  );
}

export function isMiniMaxVideoConfigured(): boolean {
  return Boolean(getMiniMaxApiKey());
}

export function toMiniMaxHistoryId(taskId: string): string {
  return `${MINIMAX_TASK_PREFIX}${taskId}`;
}

export function parseMiniMaxHistoryId(
  historyId: string | null | undefined,
): string | null {
  if (!historyId?.startsWith(MINIMAX_TASK_PREFIX)) return null;
  const id = historyId.slice(MINIMAX_TASK_PREFIX.length).trim();
  return id || null;
}

function miniMaxHeaders(): HeadersInit {
  const key = getMiniMaxApiKey();
  if (!key) throw new Error("MINIMAX_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function miniMaxFetch<T>(
  pathname: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${getMiniMaxBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      ...miniMaxHeaders(),
      ...(init.headers || {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  let data: T & { base_resp?: { status_code?: number; status_msg?: string } };
  try {
    data = JSON.parse(text) as T & {
      base_resp?: { status_code?: number; status_msg?: string };
    };
  } catch {
    throw new Error(
      `MiniMax HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`,
    );
  }

  const code = data.base_resp?.status_code;
  if (!res.ok || (typeof code === "number" && code !== 0)) {
    const msg =
      data.base_resp?.status_msg ||
      text.slice(0, 240) ||
      res.statusText ||
      "MiniMax API error";
    throw new Error(`MiniMax API ${res.status}: ${msg}`);
  }

  return data;
}

function toMiniMaxApiResolution(quality: MiniMaxH3Quality): "768P" | "2K" {
  return quality === "2k" ? "2K" : "768P";
}

function normalizeMiniMaxRatio(raw?: string | null): string {
  const r = String(raw || "16:9").trim();
  const allowed = new Set([
    "16:9",
    "9:16",
    "1:1",
    "4:3",
    "3:4",
    "21:9",
    "2:3",
    "3:2",
  ]);
  return allowed.has(r) ? r : "16:9";
}

async function resolvePublicImageUrl(
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

export type MiniMaxCreateVideoInput = {
  prompt: string;
  durationSec?: number;
  resolution?: string | null;
  aspectRatio?: string | null;
  startFrame?: VisualReference | null;
  endFrame?: VisualReference | null;
  referenceImages?: VisualReference[];
};

export async function createMiniMaxVideoTask(
  input: MiniMaxCreateVideoInput,
): Promise<{ taskId: string }> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required for MiniMax video");

  const duration = clampMiniMaxH3Duration(input.durationSec);
  const quality = normalizeMiniMaxH3Quality(input.resolution);
  const resolution = toMiniMaxApiResolution(quality);

  const content: MiniMaxContentItem[] = [{ type: "text", text: prompt }];

  const startUrl = await resolvePublicImageUrl(input.startFrame);
  const endUrl = await resolvePublicImageUrl(input.endFrame);
  const refUrls: string[] = [];
  for (const ref of (input.referenceImages || []).slice(0, 8)) {
    const url = await resolvePublicImageUrl(ref);
    if (url) refUrls.push(url);
  }

  let mode: "text" | "image" | "start_end" | "reference" = "text";
  if (startUrl && endUrl) {
    mode = "start_end";
    content.push({
      type: "image_url",
      image_url: { url: startUrl },
      role: "first_frame",
    });
    content.push({
      type: "image_url",
      image_url: { url: endUrl },
      role: "last_frame",
    });
  } else if (startUrl) {
    mode = "image";
    content.push({
      type: "image_url",
      image_url: { url: startUrl },
      role: "first_frame",
    });
  } else if (refUrls.length > 0) {
    mode = "reference";
    for (const url of refUrls) {
      content.push({
        type: "image_url",
        image_url: { url },
        role: "reference_image",
      });
    }
  }

  const payload: Record<string, unknown> = {
    model: MINIMAX_H3_API_MODEL,
    content,
    duration,
    resolution,
  };

  if (mode === "text") {
    payload.ratio = normalizeMiniMaxRatio(input.aspectRatio);
  }

  const data = await miniMaxFetch<MiniMaxCreateResponse>("/v2/video_generation", {
    method: "POST",
    json: payload,
  });

  const taskId = String(data.task_id || "").trim();
  if (!taskId) {
    throw new Error("MiniMax did not return a task_id");
  }

  return { taskId };
}

export function mapMiniMaxTaskStatus(
  status?: string,
): "COMPLETED" | "RUNNING" | "FAILED" {
  const s = String(status || "").toLowerCase();
  if (s === "succeeded" || s === "success" || s === "completed") {
    return "COMPLETED";
  }
  if (s === "failed" || s === "cancelled" || s === "canceled") {
    return "FAILED";
  }
  return "RUNNING";
}

export function miniMaxFailureMessage(task: MiniMaxTask): string {
  const err = task.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && "message" in err && err.message) {
    return String(err.message);
  }
  return "فشل توليد MiniMax H3. حاول مرة أخرى.";
}

export async function getMiniMaxVideoTask(taskId: string): Promise<{
  status: "COMPLETED" | "RUNNING" | "FAILED";
  remoteUrl?: string;
  error?: string;
}> {
  const data = await miniMaxFetch<MiniMaxQueryResponse>(
    `/v2/query/video_generation/${encodeURIComponent(taskId)}`,
    { method: "GET" },
  );
  const task = data.task || {};
  const mapped = mapMiniMaxTaskStatus(task.status);
  const remoteUrl = task.content?.url?.trim() || undefined;

  if (mapped === "COMPLETED" && remoteUrl) {
    return { status: "COMPLETED", remoteUrl };
  }
  if (mapped === "FAILED") {
    return { status: "FAILED", error: miniMaxFailureMessage(task) };
  }
  if (mapped === "COMPLETED" && !remoteUrl) {
    return { status: "RUNNING" };
  }
  return { status: "RUNNING" };
}

export async function downloadMiniMaxVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl, {
    redirect: "follow",
    headers: { Accept: "video/*", "User-Agent": "VyronixMiniMax/1.0" },
  });
  if (!res.ok) {
    throw new Error(`MiniMax video download failed (${res.status})`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) {
    throw new Error("MiniMax returned an empty video file");
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const { localPath } = await saveLocalVideo({
    bytes,
    contentType,
    prefix: "minimax",
  });
  return localPath;
}

export async function resolveMiniMaxVideoUrl(taskId: string): Promise<string | null> {
  const task = await getMiniMaxVideoTask(taskId);
  if (task.status !== "COMPLETED" || !task.remoteUrl) return null;
  return downloadMiniMaxVideo(task.remoteUrl);
}

export type MiniMaxRecoverInput = {
  userId: string;
  assetId: string;
  historyId: string;
  hidden?: boolean;
  mode?: string | null;
};

/** Pull a finished MiniMax clip into Vyronix storage (even after a false timeout). */
export async function tryRecoverMiniMaxAsset(
  input: MiniMaxRecoverInput,
): Promise<"completed" | "failed" | "pending"> {
  const mmId = parseMiniMaxHistoryId(input.historyId);
  if (!mmId) return "pending";

  const task = await getMiniMaxVideoTask(mmId);
  if (task.status === "COMPLETED" && task.remoteUrl) {
    const { updateAsset } = await import("@/lib/db");
    const { warmVideoPosterBackground } = await import("@/lib/poster-cache");
    const localPath = await downloadMiniMaxVideo(task.remoteUrl);
    await updateAsset(input.assetId, input.userId, {
      historyId: input.historyId,
      url: localPath,
      status: "completed",
      error: undefined,
      hidden: input.mode === "sequence-part" ? true : false,
    });
    warmVideoPosterBackground({ url: localPath, historyId: input.historyId });
    console.info(`[veronix] minimax recovered ${mmId} → ${localPath}`);
    return "completed";
  }
  if (task.status === "FAILED") return "failed";
  return "pending";
}

export async function waitForMiniMaxVideoTask(
  taskId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ localPath: string; remoteUrl: string }> {
  const timeoutMs = options?.timeoutMs ?? MINIMAX_JOB_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? MINIMAX_POLL_INTERVAL_MS;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const task = await getMiniMaxVideoTask(taskId);
    if (task.status === "COMPLETED" && task.remoteUrl) {
      const localPath = await downloadMiniMaxVideo(task.remoteUrl);
      return { localPath, remoteUrl: task.remoteUrl };
    }
    if (task.status === "FAILED") {
      throw new Error(task.error || "MiniMax video generation failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("MiniMax video generation timed out");
}

export type MiniMaxJobFinalizeInput = {
  taskId: string;
  historyId: string;
  assetId: string;
  userId: string;
};

const miniMaxFinalizeInflight = new Set<string>();

export async function finalizeMiniMaxVideoJob(
  input: MiniMaxJobFinalizeInput,
): Promise<void> {
  if (miniMaxFinalizeInflight.has(input.taskId)) return;
  miniMaxFinalizeInflight.add(input.taskId);

  const { updateAsset } = await import("@/lib/db");
  const { refundFailedAssetCredits } = await import("@/lib/credit-refund");
  const { warmVideoPosterBackground } = await import("@/lib/poster-cache");

  try {
    const finished = await waitForMiniMaxVideoTask(input.taskId);
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
      `[veronix] minimax job done ${input.taskId} → ${finished.localPath}`,
    );
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message.includes("MiniMax")
          ? error.message
          : `MiniMax: ${error.message}`
        : "فشل توليد MiniMax H3";
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
      `[veronix] minimax job failed ${input.taskId}:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    miniMaxFinalizeInflight.delete(input.taskId);
  }
}
