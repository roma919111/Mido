/**
 * Gemini Omni Flash — video generation via Interactions API.
 * https://ai.google.dev/api/interactions-api
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  GEMINI_OMNI_FLASH_API_MODEL,
  GEMINI_OMNI_FLASH_MODEL_ID,
  GEMINI_JOB_TIMEOUT_MS,
  GEMINI_POLL_INTERVAL_MS,
  GEMINI_TASK_PREFIX,
} from "@/lib/gemini-constants";
import { saveLocalVideo } from "@/lib/local-media";
import type { VisualReference } from "@/lib/types";
import { resolveGenerationFile } from "@/lib/veronix-outro";
import { ensurePlainRefUrl } from "@/lib/byteplus-ark";

export {
  GEMINI_OMNI_FLASH_MODEL_ID,
  GEMINI_OMNI_FLASH_API_MODEL,
  GEMINI_TASK_PREFIX,
};

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type GeminiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "video"; uri: string; mime_type?: string };

type GeminiInteraction = {
  id?: string;
  status?: string;
  updated?: string;
  created?: string;
  error?: { message?: string } | string;
  output_video?: GeminiVideoPart;
  outputs?: Array<{ type?: string; content?: GeminiVideoPart[] }>;
  steps?: Array<{
    type?: string;
    content?: GeminiVideoPart[];
  }>;
};

type GeminiVideoPart = {
  type?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
};

export function getGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    undefined
  );
}

export function isGeminiVideoConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function toGeminiHistoryId(interactionId: string): string {
  return `${GEMINI_TASK_PREFIX}${interactionId}`;
}

export function parseGeminiHistoryId(
  historyId: string | null | undefined,
): string | null {
  if (!historyId?.startsWith(GEMINI_TASK_PREFIX)) return null;
  const id = historyId.slice(GEMINI_TASK_PREFIX.length).trim();
  return id || null;
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

async function readLocalImageBytes(
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

async function readImageRef(
  ref: VisualReference | null | undefined,
): Promise<GeminiContentPart | null> {
  const resolved = await ensurePlainRefUrl(ref);
  if (!resolved) return null;

  if (resolved.startsWith("data:image/")) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i.exec(resolved);
    if (!m?.[2]) return null;
    return {
      type: "image",
      data: m[2],
      mime_type: m[1] || "image/jpeg",
    };
  }

  const local = await readLocalImageBytes(resolved);
  if (local) {
    return {
      type: "image",
      data: local.bytes.toString("base64"),
      mime_type: local.mime,
    };
  }

  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    const res = await fetch(resolved, {
      redirect: "follow",
      headers: { Accept: "image/*", "User-Agent": "VyronixGemini/1.0" },
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 32) return null;
    const mime =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    return {
      type: "image",
      data: bytes.toString("base64"),
      mime_type: mime,
    };
  }

  return null;
}

async function geminiAuthHeaders(): Promise<Headers> {
  const key = getGeminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const headers = new Headers();
  // All Gemini keys (AIza… and newer AQ… auth keys) use x-goog-api-key — not Bearer.
  headers.set("x-goog-api-key", key);
  return headers;
}

async function geminiFetch<T>(
  pathname: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = await geminiAuthHeaders();
  const passed = new Headers(init.headers);
  passed.forEach((value, name) => headers.set(name, value));
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  let data: T & { error?: { message?: string } };
  try {
    data = JSON.parse(text) as T & { error?: { message?: string } };
  } catch {
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`);
  }

  if (!res.ok) {
    const msg =
      (typeof data?.error === "object" && data.error?.message) ||
      (typeof data?.error === "string" ? data.error : null) ||
      text.slice(0, 240) ||
      res.statusText;
    throw new Error(`Gemini API ${res.status}: ${msg}`);
  }

  return data;
}

function normalizeGeminiDuration(durationSec: number): string {
  const sec = Math.max(3, Math.min(10, Math.round(durationSec) || 5));
  return `${sec}s`;
}

function normalizeGeminiAspectRatio(raw?: string | null): "16:9" | "9:16" {
  const r = String(raw || "16:9").trim();
  return r === "9:16" ? "9:16" : "16:9";
}

function normalizeVideoPart(raw: unknown): GeminiVideoPart | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = String(o.type || "").toLowerCase();
  if (type && type !== "video") return null;

  const data =
    (typeof o.data === "string" && o.data) ||
    (typeof o.base64 === "string" && o.base64) ||
    undefined;
  const uri =
    (typeof o.uri === "string" && o.uri) ||
    (typeof o.file_uri === "string" && o.file_uri) ||
    (typeof o.url === "string" && o.url) ||
    undefined;

  if (!data && !uri) return null;
  return {
    type: "video",
    data,
    uri,
    mime_type:
      (typeof o.mime_type === "string" && o.mime_type) ||
      (typeof o.mimeType === "string" && o.mimeType) ||
      undefined,
  };
}

function deepFindVideoPart(value: unknown, depth = 0): GeminiVideoPart | null {
  if (depth > 10 || value == null) return null;

  const direct = normalizeVideoPart(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = deepFindVideoPart(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.fileData && typeof o.fileData === "object") {
      const fd = o.fileData as { fileUri?: string; mimeType?: string };
      if (fd.fileUri) {
        return { type: "video", uri: fd.fileUri, mime_type: fd.mimeType };
      }
    }
    for (const child of Object.values(o)) {
      const hit = deepFindVideoPart(child, depth + 1);
      if (hit) return hit;
    }
  }

  return null;
}

export function extractVideoPart(interaction: GeminiInteraction): GeminiVideoPart | null {
  const fromOutput = normalizeVideoPart(interaction.output_video);
  if (fromOutput) return fromOutput;

  for (const step of interaction.steps || []) {
    for (const part of step.content || []) {
      const hit = normalizeVideoPart(part);
      if (hit) return hit;
    }
  }

  for (const output of interaction.outputs || []) {
    for (const part of output.content || []) {
      const hit = normalizeVideoPart(part);
      if (hit) return hit;
    }
  }

  return deepFindVideoPart(interaction);
}

function parseGeminiFileId(uri: string): string | null {
  const trimmed = uri.trim();
  const fromPath = trimmed.match(/\/files\/([^/?:]+)/i)?.[1];
  if (fromPath) return fromPath;
  if (trimmed.startsWith("files/")) return trimmed.slice("files/".length).split(/[/?#]/)[0] || null;
  return null;
}

async function waitForGeminiFileActive(fileRef: string): Promise<string> {
  const fileId = parseGeminiFileId(fileRef) || fileRef.replace(/^files\//, "").split(/[/?#]/)[0];
  if (!fileId) throw new Error("Gemini file id missing from uri");

  const started = Date.now();
  while (Date.now() - started < 240_000) {
    const meta = await geminiFetch<{ state?: string; name?: string }>(
      `/files/${encodeURIComponent(fileId)}`,
      { method: "GET" },
    );
    const state = String(meta.state || "").toUpperCase();
    if (state === "ACTIVE") return fileId;
    if (state === "FAILED") throw new Error("Gemini file processing failed");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Gemini file was not ready in time");
}

async function downloadGeminiFileMedia(fileId: string): Promise<Buffer> {
  const activeId = await waitForGeminiFileActive(fileId);
  const headers = await geminiAuthHeaders();
  const res = await fetch(
    `${API_BASE}/files/${encodeURIComponent(activeId)}:download?alt=media`,
    {
      redirect: "follow",
      headers: Object.fromEntries(headers.entries()),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini file download failed (${res.status})`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) {
    throw new Error("Gemini returned an empty video file");
  }
  return bytes;
}

export async function persistGeminiVideoPart(
  part: GeminiVideoPart,
): Promise<string> {
  if (part.data) {
    const b64 = part.data.replace(/^data:video\/[a-z0-9.+-]+;base64,/i, "");
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length < 1000) {
      throw new Error("Gemini returned an empty inline video");
    }
    const { localPath } = await saveLocalVideo({
      bytes,
      contentType: part.mime_type || "video/mp4",
      prefix: "gemini",
    });
    return localPath;
  }

  if (part.uri) {
    const fileId = parseGeminiFileId(part.uri);
    const bytes = fileId
      ? await downloadGeminiFileMedia(fileId)
      : await downloadGeminiFileMedia(part.uri);
    const { localPath } = await saveLocalVideo({
      bytes,
      contentType: part.mime_type || "video/mp4",
      prefix: "gemini",
    });
    return localPath;
  }

  throw new Error("Gemini completed without video data");
}

export async function persistGeminiVideoFromInteraction(
  interaction: GeminiInteraction,
): Promise<string | null> {
  const part = extractVideoPart(interaction);
  if (!part) return null;
  return persistGeminiVideoPart(part);
}

export type GeminiCreateVideoInput = {
  prompt: string;
  durationSec?: number;
  aspectRatio?: string | null;
  startFrame?: VisualReference | null;
  endFrame?: VisualReference | null;
  referenceImages?: VisualReference[];
};

export async function createGeminiVideoInteraction(
  input: GeminiCreateVideoInput,
): Promise<{ interactionId: string; status: string }> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required for Gemini video");

  const startImage = await readImageRef(input.startFrame);
  const endImage = await readImageRef(input.endFrame);
  const refImages: GeminiContentPart[] = [];
  for (const ref of (input.referenceImages || []).slice(0, 5)) {
    const img = await readImageRef(ref);
    if (img) refImages.push(img);
  }

  let task: "text_to_video" | "image_to_video" | "reference_to_video" =
    "text_to_video";
  const inputParts: GeminiContentPart[] = [{ type: "text", text: prompt }];

  if (startImage || endImage) {
    task = "image_to_video";
    if (startImage) inputParts.push(startImage);
    if (endImage) inputParts.push(endImage);
  } else if (refImages.length > 0) {
    task = "reference_to_video";
    inputParts.push(...refImages);
  }

  const interaction = await geminiFetch<GeminiInteraction>("/interactions", {
    method: "POST",
    json: {
      model: GEMINI_OMNI_FLASH_API_MODEL,
      input: inputParts.length === 1 ? prompt : inputParts,
      response_format: {
        type: "video",
        duration: normalizeGeminiDuration(input.durationSec ?? 5),
        aspect_ratio: normalizeGeminiAspectRatio(input.aspectRatio),
        delivery: "uri",
      },
      ...(task !== "text_to_video"
        ? {
            generation_config: {
              video_config: { task },
            },
          }
        : {}),
      background: true,
    },
  });

  const interactionId = String(interaction.id || "").trim();
  if (!interactionId) {
    throw new Error("Gemini did not return an interaction id");
  }

  return {
    interactionId,
    status: String(interaction.status || "in_progress"),
  };
}

export async function getGeminiInteraction(
  interactionId: string,
): Promise<GeminiInteraction> {
  return geminiFetch<GeminiInteraction>(
    `/interactions/${encodeURIComponent(interactionId)}`,
    { method: "GET" },
  );
}

export function mapGeminiInteractionStatus(
  status?: string,
): "COMPLETED" | "RUNNING" | "FAILED" {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "COMPLETED";
  if (
    s === "failed" ||
    s === "cancelled" ||
    s === "requires_action" ||
    s === "incomplete" ||
    s === "timed_out"
  ) {
    return "FAILED";
  }
  return "RUNNING";
}

export function geminiFailureMessage(interaction: GeminiInteraction): string {
  const err = interaction.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && "message" in err && err.message) {
    return String(err.message);
  }
  return "فشل توليد Gemini Omni Flash. حاول مرة أخرى.";
}

export async function resolveGeminiVideoUrl(
  interactionId: string,
): Promise<string | null> {
  const interaction = await getGeminiInteraction(interactionId);
  return persistGeminiVideoFromInteraction(interaction);
}

export async function waitForGeminiVideoInteraction(
  interactionId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ localPath: string; interaction: GeminiInteraction }> {
  const timeoutMs = options?.timeoutMs ?? GEMINI_JOB_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? GEMINI_POLL_INTERVAL_MS;
  const started = Date.now();
  let completedGraceStarted: number | null = null;
  let lastLoggedMin = 0;

  while (Date.now() - started < timeoutMs) {
    const interaction = await getGeminiInteraction(interactionId);
    const mapped = mapGeminiInteractionStatus(interaction.status);
    const part = extractVideoPart(interaction);

    // Video payload can land before status flips to completed.
    if (part) {
      try {
        const localPath = await persistGeminiVideoPart(part);
        return { localPath, interaction };
      } catch (error) {
        if (mapped === "FAILED") {
          throw error instanceof Error ? error : new Error(String(error));
        }
        console.warn(
          `[veronix] gemini ${interactionId} has video part but persist failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (mapped === "COMPLETED" && !part) {
      if (completedGraceStarted == null) completedGraceStarted = Date.now();
      if (Date.now() - completedGraceStarted > 120_000) {
        throw new Error("Gemini completed without a downloadable video");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }

    if (mapped === "FAILED") {
      throw new Error(geminiFailureMessage(interaction));
    }

    const elapsedMin = Math.floor((Date.now() - started) / 60_000);
    if (elapsedMin >= 2 && elapsedMin > lastLoggedMin) {
      lastLoggedMin = elapsedMin;
      console.info(
        `[veronix] gemini wait ${interactionId} raw=${interaction.status} elapsed=${elapsedMin}m`,
      );
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Gemini video generation timed out");
}

export type GeminiJobFinalizeInput = {
  interactionId: string;
  historyId: string;
  assetId: string;
  userId: string;
};

/** Finish a background Gemini job — update asset + refund on failure. */
const geminiFinalizeInflight = new Set<string>();

export async function finalizeGeminiVideoJob(
  input: GeminiJobFinalizeInput,
): Promise<void> {
  if (geminiFinalizeInflight.has(input.interactionId)) return;
  geminiFinalizeInflight.add(input.interactionId);

  const { updateAsset } = await import("@/lib/db");
  const { refundFailedAssetCredits } = await import("@/lib/credit-refund");
  const { warmVideoPosterBackground } = await import("@/lib/poster-cache");
  const { translateGeminiError } = await import("@/lib/byteplus-errors");

  try {
    const finished = await waitForGeminiVideoInteraction(input.interactionId);
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
      `[veronix] gemini job done ${input.interactionId} → ${finished.localPath}`,
    );
  } catch (error) {
    const msg = translateGeminiError(error, "فشل توليد Gemini");
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
      `[veronix] gemini job failed ${input.interactionId}:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    geminiFinalizeInflight.delete(input.interactionId);
  }
}
