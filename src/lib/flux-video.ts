/**
 * FLUX 3 video — Black Forest Labs direct API.
 * https://docs.bfl.ai/flux_3/flux3_overview
 */

import { readFile } from "node:fs/promises";
import {
  FLUX_JOB_TIMEOUT_MS,
  FLUX_POLL_INTERVAL_MS,
  FLUX_TASK_PREFIX,
  FLUX_VIDEO_MODEL_ID,
  type FluxVideoQuality,
} from "@/lib/flux-constants";
import {
  clampFluxVideoDuration,
  fluxQualityToApiResolution,
  normalizeFluxVideoQuality,
} from "@/lib/flux-pricing";
import { saveLocalVideo } from "@/lib/local-media";
import type { VisualReference } from "@/lib/types";
import { resolveGenerationFile } from "@/lib/veronix-outro";

export { FLUX_VIDEO_MODEL_ID, FLUX_TASK_PREFIX };

const DEFAULT_BASE = "https://api.bfl.ai";

type BflSubmitResponse = {
  id?: string;
  polling_url?: string;
  status?: string;
  detail?: unknown;
};

type BflPollResponse = {
  id?: string;
  status?: string;
  progress?: number;
  result?: {
    sample?: string;
    prompt?: string;
    duration?: number;
  } | null;
  error?: string;
  details?: unknown;
};

export function getBflApiKey(): string | undefined {
  return (
    process.env.BFL_API_KEY?.trim() ||
    process.env.FLUX_API_KEY?.trim() ||
    undefined
  );
}

export function getBflBaseUrl(): string {
  return (
    process.env.BFL_API_BASE_URL?.trim()?.replace(/\/+$/, "") || DEFAULT_BASE
  );
}

export function isFluxVideoConfigured(): boolean {
  return Boolean(getBflApiKey());
}

export function toFluxHistoryId(taskId: string): string {
  return `${FLUX_TASK_PREFIX}${taskId}`;
}

export function parseFluxHistoryId(
  historyId: string | null | undefined,
): string | null {
  if (!historyId?.startsWith(FLUX_TASK_PREFIX)) return null;
  const id = historyId.slice(FLUX_TASK_PREFIX.length).trim();
  return id || null;
}

function bflHeaders(): HeadersInit {
  const key = getBflApiKey();
  if (!key) throw new Error("BFL_API_KEY is not configured");
  return {
    "x-key": key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function formatBflError(status: number, text: string, data?: BflSubmitResponse): string {
  const detail = data?.detail;
  const detailText =
    typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail
            .map((d) =>
              typeof d === "object" && d && "msg" in d
                ? String((d as { msg?: string }).msg)
                : JSON.stringify(d),
            )
            .join("; ")
        : "";
  return (
    detailText ||
    text.slice(0, 320) ||
    `BFL HTTP ${status}`
  );
}

function mimeFromName(name: string, fallback: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".mp4")) return "video/mp4";
  return fallback;
}

/** BFL accepts an https URL or a data URL / raw base64 payload. */
async function resolveBflMedia(
  ref: VisualReference | string | null | undefined,
  kind: "image" | "video",
): Promise<string | null> {
  const raw =
    typeof ref === "string"
      ? ref.trim()
      : String(ref?.url || "").trim();
  if (!raw) return null;

  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const filePath = resolveGenerationFile(raw.startsWith("/") ? raw : `/${raw}`);
  if (filePath) {
    const bytes = await readFile(filePath);
    const mime = mimeFromName(
      filePath,
      kind === "video" ? "video/mp4" : "image/jpeg",
    );
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }

  const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (base && raw.startsWith("/")) return `${base}${raw}`;
  return raw;
}

function normalizeFluxAspectRatio(raw?: string | null): string {
  const r = String(raw || "auto").trim();
  if (
    r === "auto" ||
    r === "21:9" ||
    r === "2:1" ||
    r === "16:9" ||
    r === "4:3" ||
    r === "1:1" ||
    r === "3:4" ||
    r === "9:16"
  ) {
    return r;
  }
  if (r === "9:16" || r === "3:4") return r;
  return "16:9";
}

export type FluxCreateVideoInput = {
  prompt: string;
  durationSec?: number;
  resolution?: string | null;
  aspectRatio?: string | null;
  startFrame?: VisualReference | null;
  endFrame?: VisualReference | null;
  referenceImages?: VisualReference[];
  referenceVideos?: VisualReference[];
};

export async function createFluxVideoTask(
  input: FluxCreateVideoInput,
): Promise<{ taskId: string; pollingUrl?: string }> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required for FLUX video");

  const duration = clampFluxVideoDuration(input.durationSec);
  const quality = normalizeFluxVideoQuality(input.resolution);
  const resolution = fluxQualityToApiResolution(quality);
  const draft = quality === "draft";
  const aspectRatio = normalizeFluxAspectRatio(input.aspectRatio);

  const videoRefs = (input.referenceVideos || [])
    .filter((r) => r?.url)
    .slice(0, 1);
  let startVideo: string | null = null;
  if (videoRefs[0]) {
    startVideo = await resolveBflMedia(videoRefs[0], "video");
  }

  const imageSlots: VisualReference[] = [];
  if (input.startFrame?.url) imageSlots.push(input.startFrame);
  for (const ref of input.referenceImages || []) {
    if (ref?.url) imageSlots.push(ref);
  }
  if (input.endFrame?.url) imageSlots.push(input.endFrame);
  const keyframes: string[] = [];
  for (const slot of imageSlots.slice(0, 10)) {
    const payload = await resolveBflMedia(slot, "image");
    if (payload) keyframes.push(payload);
  }

  const body: Record<string, unknown> = {
    prompt,
    duration,
    resolution,
    draft,
    generate_audio: true,
    aspect_ratio: aspectRatio,
    safety_tolerance: 2,
  };

  if (startVideo) {
    body.mode = "v2v";
    body.start_video = startVideo;
  } else if (keyframes.length) {
    body.mode = "i2v";
    body.keyframes = keyframes;
  } else {
    body.mode = "t2v";
  }

  const res = await fetch(`${getBflBaseUrl()}/v1/flux-3-video`, {
    method: "POST",
    headers: bflHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: BflSubmitResponse = {};
  try {
    data = JSON.parse(text) as BflSubmitResponse;
  } catch {
    throw new Error(`FLUX HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  if (!res.ok) {
    throw new Error(`FLUX API ${res.status}: ${formatBflError(res.status, text, data)}`);
  }

  const taskId = String(data.id || "").trim();
  if (!taskId) throw new Error("FLUX did not return a task id");
  return { taskId, pollingUrl: data.polling_url };
}

export type FluxVideoTask = {
  status: "RUNNING" | "COMPLETED" | "FAILED";
  remoteUrl?: string;
  error?: string;
};

function mapFluxStatus(raw?: string | null): FluxVideoTask["status"] {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "ready") return "COMPLETED";
  if (
    s === "error" ||
    s === "failed" ||
    s === "request moderated" ||
    s === "content moderated" ||
    s === "task not found"
  ) {
    return "FAILED";
  }
  return "RUNNING";
}

export async function getFluxVideoTask(taskId: string): Promise<FluxVideoTask> {
  const res = await fetch(
    `${getBflBaseUrl()}/v1/get_result?id=${encodeURIComponent(taskId)}`,
    { method: "GET", headers: bflHeaders() },
  );
  const text = await res.text();
  let data: BflPollResponse = {};
  try {
    data = JSON.parse(text) as BflPollResponse;
  } catch {
    throw new Error(`FLUX poll HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  if (!res.ok) {
    return {
      status: "FAILED",
      error: formatBflError(res.status, text, data as BflSubmitResponse),
    };
  }

  const status = mapFluxStatus(data.status);
  const remoteUrl = data.result?.sample;
  const moderated =
    String(data.status || "").toLowerCase().includes("moderated");
  return {
    status,
    remoteUrl,
    error:
      status === "FAILED"
        ? moderated
          ? "رفض FLUX المحتوى (اعتدال السلامة)"
          : data.error || "فشل توليد FLUX 3"
        : undefined,
  };
}

export async function downloadFluxVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl, {
    redirect: "follow",
    headers: { Accept: "video/*", "User-Agent": "VyronixFlux/1.0" },
  });
  if (!res.ok) {
    throw new Error(`FLUX video download failed (${res.status})`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) {
    throw new Error("FLUX returned an empty video file");
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const { localPath } = await saveLocalVideo({
    bytes,
    contentType,
    prefix: "flux",
  });
  return localPath;
}

export async function resolveFluxVideoUrl(taskId: string): Promise<string | null> {
  const task = await getFluxVideoTask(taskId);
  if (task.status !== "COMPLETED" || !task.remoteUrl) return null;
  return downloadFluxVideo(task.remoteUrl);
}

export type FluxRecoverInput = {
  userId: string;
  assetId: string;
  historyId: string;
  hidden?: boolean;
  mode?: string | null;
};

export async function tryRecoverFluxAsset(
  input: FluxRecoverInput,
): Promise<"completed" | "failed" | "pending"> {
  const taskId = parseFluxHistoryId(input.historyId);
  if (!taskId) return "pending";

  const task = await getFluxVideoTask(taskId);
  if (task.status === "COMPLETED" && task.remoteUrl) {
    const { updateAsset } = await import("@/lib/db");
    const { warmVideoPosterBackground } = await import("@/lib/poster-cache");
    const localPath = await downloadFluxVideo(task.remoteUrl);
    await updateAsset(input.assetId, input.userId, {
      historyId: input.historyId,
      url: localPath,
      status: "completed",
      error: undefined,
      hidden: input.mode === "sequence-part" ? true : false,
    });
    warmVideoPosterBackground({ url: localPath, historyId: input.historyId });
    console.info(`[veronix] flux recovered ${taskId} → ${localPath}`);
    return "completed";
  }
  if (task.status === "FAILED") return "failed";
  return "pending";
}

export async function waitForFluxVideoTask(
  taskId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ localPath: string; remoteUrl: string }> {
  const timeoutMs = options?.timeoutMs ?? FLUX_JOB_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? FLUX_POLL_INTERVAL_MS;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const task = await getFluxVideoTask(taskId);
    if (task.status === "COMPLETED" && task.remoteUrl) {
      const localPath = await downloadFluxVideo(task.remoteUrl);
      return { localPath, remoteUrl: task.remoteUrl };
    }
    if (task.status === "FAILED") {
      throw new Error(task.error || "FLUX video generation failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("FLUX video generation timed out");
}

export type FluxJobFinalizeInput = {
  taskId: string;
  historyId: string;
  assetId: string;
  userId: string;
};

const fluxFinalizeInflight = new Set<string>();

export async function finalizeFluxVideoJob(
  input: FluxJobFinalizeInput,
): Promise<void> {
  if (fluxFinalizeInflight.has(input.taskId)) return;
  fluxFinalizeInflight.add(input.taskId);

  const { updateAsset } = await import("@/lib/db");
  const { refundFailedAssetCredits } = await import("@/lib/credit-refund");
  const { warmVideoPosterBackground } = await import("@/lib/poster-cache");

  try {
    const finished = await waitForFluxVideoTask(input.taskId);
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
      `[veronix] flux job done ${input.taskId} → ${finished.localPath}`,
    );
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message.includes("FLUX")
          ? error.message
          : `FLUX: ${error.message}`
        : "فشل توليد FLUX 3";
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
      `[veronix] flux job failed ${input.taskId}:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    fluxFinalizeInflight.delete(input.taskId);
  }
}

export type { FluxVideoQuality };
