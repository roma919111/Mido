/**
 * BytePlus ModelArk — Seedance / Dreamina video generation.
 * Sole video provider for Veronix (seedance-2-mini). OpenArt is not used for generate.
 */

import {
  compressReferenceForBytePlus,
  compressReferencePlain,
  isInputImagePrivacyError,
  stylizeReferenceImage,
  toSemiRealisticScenePrompt,
} from "@/lib/reference-sanitize";
import {
  getBytePlusApiKeyForModel,
  getBytePlusArkModelId,
  SEEDANCE_2_MODEL_ID,
} from "@/lib/byteplus-constants";
import { resolveGenerationFile } from "@/lib/veronix-outro";
import type { VisualReference } from "@/lib/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const BYTEPLUS_TASK_PREFIX = "bp:";

const DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";
const DEFAULT_MODEL = "dreamina-seedance-2-0-mini-260615";

/**
 * First send: AI / 3D-render digital character look (BytePlus privacy bypass).
 * Soften / bloom / isolate / grade happen here before create.
 */
async function toCompressedDataUrl(
  bytes: Buffer,
  mimeHint?: string,
  opts?: { aiDigitalFilter?: boolean },
): Promise<string> {
  const useAi = opts?.aiDigitalFilter !== false;
  try {
    const out = useAi
      ? await compressReferenceForBytePlus(bytes)
      : await compressReferencePlain(bytes);
    console.info(
      `[veronix] character still prepared before ${useAi ? "BytePlus (AI filter)" : "provider (plain)"}`,
      `inBytes=${bytes.length}`,
      `outBytes=${out.length}`,
      `mime=${mimeHint || "image/jpeg"}`,
    );
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch (err) {
    console.warn(
      "[veronix] AI digital character filter failed:",
      err instanceof Error ? err.message : err,
    );
    try {
      const out = await sharp(bytes)
        .rotate()
        .resize({
          width: 1024,
          height: 1024,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      return `data:image/jpeg;base64,${out.toString("base64")}`;
    } catch {
      const mime = mimeHint || "image/jpeg";
      return `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }
}

export function getBytePlusApiKey(catalogModelId?: string | null): string | undefined {
  return getBytePlusApiKeyForModel(catalogModelId);
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

export function getBytePlusModelId(catalogModelId?: string | null): string {
  return getBytePlusArkModelId(catalogModelId);
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
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role?: string;
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role?: string;
    };

export type BytePlusCreateInput = {
  /** Catalog model id — selects Ark model + API key. */
  catalogModelId?: string;
  prompt: string;
  duration: number;
  ratio?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  /** Absolute http(s) or data: URL for first-frame */
  startFrameUrl?: string | null;
  /** Absolute http(s) or data: URL for last-frame (requires startFrameUrl) */
  lastFrameUrl?: string | null;
  /**
   * Multimodal visual references (role=reference_image).
   * Mutually exclusive with first/last frame mode per Seedance rules (mini).
   * Seedance 2.0 supports mixed reference_image + reference_video + reference_audio.
   */
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
  /** Seedance 2.0 — allow image + video + audio refs in one task. */
  multimodalRefs?: boolean;
  resolution?: string;
  /** Ark image role when only a single start frame is provided */
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

function authHeaders(catalogModelId?: string | null): HeadersInit {
  const key = getBytePlusApiKey(catalogModelId);
  if (!key) throw new Error("BYTEPLUS_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export type BytePlusAuthProbe = {
  ok: boolean;
  configured: boolean;
  model: string;
  catalogModelId?: string;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  keyHint?: string;
};

function maskApiKeyHint(key?: string | null): string | undefined {
  const k = String(key || "").trim();
  if (!k) return undefined;
  if (k.length <= 12) return `len=${k.length}`;
  return `${k.slice(0, 6)}…${k.slice(-4)} (len=${k.length})`;
}

/** Lightweight auth probe — does not create a billable video task. */
export async function probeBytePlusVideoAuth(
  catalogModelId?: string | null,
): Promise<BytePlusAuthProbe> {
  const key = getBytePlusApiKey(catalogModelId);
  const model = getBytePlusArkModelId(catalogModelId);
  const keyHint = maskApiKeyHint(key);
  if (!key) {
    return {
      ok: false,
      configured: false,
      model,
      catalogModelId: catalogModelId || undefined,
      errorMessage: "BYTEPLUS_API_KEY is not configured",
      keyHint,
    };
  }

  try {
    const res = await fetch(`${getBytePlusBaseUrl()}/contents/generations/tasks`, {
      method: "POST",
      headers: authHeaders(catalogModelId),
      body: JSON.stringify({
        model,
        content: [{ type: "text", text: "vyronix auth probe" }],
        duration: 4,
        ratio: "16:9",
        resolution: "480p",
      }),
    });
    const data = await parseJson(res);
    const errObj = data.error as { code?: string; message?: string } | undefined;
    if (res.ok && !errObj?.code) {
      return {
        ok: true,
        configured: true,
        model,
        catalogModelId: catalogModelId || undefined,
        httpStatus: res.status,
        keyHint,
      };
    }
    return {
      ok: false,
      configured: true,
      model,
      catalogModelId: catalogModelId || undefined,
      httpStatus: res.status,
      errorCode: errObj?.code,
      errorMessage: errObj?.message || String(data.message || res.statusText),
      keyHint,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      model,
      catalogModelId: catalogModelId || undefined,
      errorMessage: error instanceof Error ? error.message : "probe failed",
      keyHint,
    };
  }
}

export async function probeAllBytePlusVideoAuth(): Promise<{
  vyronix: BytePlusAuthProbe;
  seedance2: BytePlusAuthProbe;
}> {
  const { SEEDANCE_MINI_MODEL_ID, SEEDANCE_2_MODEL_ID } = await import(
    "@/lib/byteplus-constants"
  );
  const [vyronix, seedance2] = await Promise.all([
    probeBytePlusVideoAuth(SEEDANCE_MINI_MODEL_ID),
    probeBytePlusVideoAuth(SEEDANCE_2_MODEL_ID),
  ]);
  return { vyronix, seedance2 };
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

function mimeFromGenerationPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

/**
 * BytePlus cannot fetch private `/generations/*` files on our volume.
 * Convert local stills to compressed data URLs with a light soft-render grade
 * (same sharp pass as resize — no extra delay beyond normal prep).
 * Remote https kept as-is unless they point at our own /generations host.
 */
export async function ensureBytePlusMediaUrl(
  url: string | null | undefined,
  opts?: { aiDigitalFilter?: boolean },
): Promise<string | null> {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  const filterOpts = { aiDigitalFilter: opts?.aiDigitalFilter };
  if (trimmed.startsWith("data:image/")) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i.exec(trimmed);
    if (!m?.[2]) return trimmed;
    try {
      const raw = Buffer.from(m[2], "base64");
      return await toCompressedDataUrl(raw, m[1], filterOpts);
    } catch {
      return trimmed;
    }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
    if (base && trimmed.startsWith(`${base}/generations/`)) {
      const localPath = trimmed.slice(base.length);
      const filePath = resolveGenerationFile(localPath);
      if (!filePath) return null;
      try {
        const bytes = await readFile(filePath);
        if (bytes.length < 32) return null;
        return await toCompressedDataUrl(
          bytes,
          mimeFromGenerationPath(filePath),
          filterOpts,
        );
      } catch {
        return null;
      }
    }
    return trimmed;
  }

  if (trimmed.startsWith("/generations/")) {
    const filePath = resolveGenerationFile(trimmed);
    if (!filePath) return null;
    try {
      const bytes = await readFile(filePath);
      if (bytes.length < 32) return null;
      return await toCompressedDataUrl(
        bytes,
        mimeFromGenerationPath(filePath),
        filterOpts,
      );
    } catch {
      return null;
    }
  }

  const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (base && trimmed.startsWith("/")) return `${base}${trimmed}`;
  return null;
}

/** Public fetchable URL for video/audio refs (no image compression). */
export async function ensureBytePlusPublicMediaUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (base && trimmed.startsWith("/")) return `${base}${trimmed}`;
  if (trimmed.startsWith("/generations/")) {
    const filePath = resolveGenerationFile(trimmed);
    if (!filePath) return null;
    const pub = process.env.APP_BASE_URL?.trim()?.replace(/\/+$/, "");
    return pub ? `${pub}${trimmed}` : null;
  }
  return null;
}

export async function ensureBytePlusRefUrl(
  ref: VisualReference | null | undefined,
  opts?: { aiDigitalFilter?: boolean },
): Promise<string | null> {
  if (!ref?.url?.trim()) return null;
  return ensureBytePlusMediaUrl(ref.url, opts);
}

/** PixVerse / Fusion — keep original colors; skip BytePlus privacy AI filter. */
export async function ensurePlainRefUrl(
  ref: VisualReference | null | undefined,
): Promise<string | null> {
  return ensureBytePlusRefUrl(ref, { aiDigitalFilter: false });
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

async function postCreateTask(
  payload: Record<string, unknown>,
  catalogModelId?: string | null,
) {
  const res = await fetch(`${getBytePlusBaseUrl()}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(catalogModelId),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  return { res, data };
}

function buildCreatePayload(
  input: BytePlusCreateInput,
  opts?: {
    frameUrl?: string | null;
    lastFrameUrl?: string | null;
    referenceUrls?: string[] | null;
    referenceVideoUrls?: string[] | null;
    referenceAudioUrls?: string[] | null;
    imageRole?: string;
    generateAudio?: boolean;
    catalogModelId?: string | null;
  },
): Record<string, unknown> {
  const content: ContentPart[] = [{ type: "text", text: input.prompt }];

  const startUrl =
    opts?.frameUrl !== undefined ? opts.frameUrl : input.startFrameUrl;
  const lastUrl =
    opts?.lastFrameUrl !== undefined ? opts.lastFrameUrl : input.lastFrameUrl;
  const refUrls =
    opts?.referenceUrls !== undefined
      ? opts.referenceUrls
      : input.referenceImageUrls;
  const videoUrls =
    opts?.referenceVideoUrls !== undefined
      ? opts.referenceVideoUrls
      : input.referenceVideoUrls;
  const audioUrls =
    opts?.referenceAudioUrls !== undefined
      ? opts.referenceAudioUrls
      : input.referenceAudioUrls;

  const multimodal =
    input.multimodalRefs ||
    input.catalogModelId === SEEDANCE_2_MODEL_ID ||
    Boolean(videoUrls?.length || audioUrls?.length);

  if (multimodal) {
    for (const url of refUrls?.slice(0, 4) || []) {
      if (!url?.trim()) continue;
      content.push({
        type: "image_url",
        image_url: { url: url.trim() },
        role: "reference_image",
      });
    }
    for (const url of videoUrls?.slice(0, 2) || []) {
      if (!url?.trim()) continue;
      content.push({
        type: "video_url",
        video_url: { url: url.trim() },
        role: "reference_video",
      });
    }
    for (const url of audioUrls?.slice(0, 2) || []) {
      if (!url?.trim()) continue;
      content.push({
        type: "audio_url",
        audio_url: { url: url.trim() },
        role: "reference_audio",
      });
    }
  } else if (startUrl) {
    content.push({
      type: "image_url",
      image_url: { url: startUrl },
      role: opts?.imageRole || input.imageRole || "first_frame",
    });
    if (lastUrl) {
      content.push({
        type: "image_url",
        image_url: { url: lastUrl },
        role: "last_frame",
      });
    }
  } else if (refUrls?.length) {
    for (const url of refUrls.slice(0, 4)) {
      if (!url?.trim()) continue;
      content.push({
        type: "image_url",
        image_url: { url: url.trim() },
        role: "reference_image",
      });
    }
  }

  // Seedance / OpenArt window: 4–15 seconds (integer steps).
  const duration = Math.max(4, Math.min(15, Math.round(input.duration)));
  const catalogModelId = opts?.catalogModelId ?? input.catalogModelId;
  const body: Record<string, unknown> = {
    model: getBytePlusModelId(catalogModelId),
    content,
    generate_audio:
      opts?.generateAudio !== undefined
        ? opts.generateAudio
        : Boolean(input.generateAudio),
    ratio: input.ratio || "16:9",
    duration,
    watermark: input.watermark === true,
  };
  if (input.resolution) {
    const r = String(input.resolution).trim().toLowerCase();
    if (["480p", "720p", "1080p", "4k"].includes(r)) {
      body.resolution = r;
    }
  }
  return body;
}

export async function createBytePlusVideoTask(
  input: BytePlusCreateInput,
): Promise<BytePlusTask> {
  const catalogModelId = input.catalogModelId;
  let payload = buildCreatePayload(input, { catalogModelId });
  let { res, data } = await postCreateTask(payload, catalogModelId);

  // Retry without resolution if the Ark build rejects the field.
  if (!res.ok && input.resolution) {
    const msg = errorTextFromCreate(data, res.status);
    if (/resolution|unknown|invalid|not support/i.test(msg) || res.status === 400) {
      const { resolution: _drop, ...rest } = payload;
      payload = rest;
      ({ res, data } = await postCreateTask(payload, catalogModelId));
    }
  }

  // Sensitive-audio rejects are common — retry once muted so the clip still lands.
  if (!res.ok && payload.generate_audio === true) {
    const msg = errorTextFromCreate(data, res.status);
    if (/OutputAudioSensitive|AudioSensitive/i.test(msg)) {
      payload = { ...payload, generate_audio: false };
      ({ res, data } = await postCreateTask(payload, catalogModelId));
    }
  }

  // If multimodal reference_image fails for a SINGLE character, try first_frame.
  // Never collapse 2+ characters into one face — that drops identity binding.
  if (
    !res.ok &&
    input.referenceImageUrls?.length === 1 &&
    !input.startFrameUrl
  ) {
    const first = input.referenceImageUrls[0]!;
    const nameHint = /@Image1 is "([^"]+)"/.exec(input.prompt || "");
    const fallbackPrompt = nameHint
      ? `${input.prompt}\nThe person in the first frame is "${nameHint[1]}".`
      : input.prompt;
    payload = buildCreatePayload(
      {
        ...input,
        prompt: fallbackPrompt,
        startFrameUrl: first,
        referenceImageUrls: [],
      },
      {
        frameUrl: first,
        referenceUrls: [],
        imageRole: "first_frame",
        generateAudio: Boolean(payload.generate_audio),
      },
    );
    ({ res, data } = await postCreateTask(payload, catalogModelId));
  }

  // Privacy block: second pass of the same frozen AI digital filter + prompt rewrite.
  // First pass alone is not always enough for BytePlus InputImageSensitive.
  const hasImages = Boolean(
    input.startFrameUrl || (input.referenceImageUrls && input.referenceImageUrls.length),
  );
  if (!res.ok && hasImages) {
    const msg = errorTextFromCreate(data, res.status);
    if (isInputImagePrivacyError(msg)) {
      const rewritten = {
        ...input,
        prompt: toSemiRealisticScenePrompt(input.prompt),
      };
      try {
        if (input.startFrameUrl) {
          const styled = await stylizeReferenceImage(input.startFrameUrl);
          payload = buildCreatePayload(rewritten, {
            frameUrl: styled,
            lastFrameUrl: input.lastFrameUrl || null,
            referenceUrls: [],
            imageRole: "first_frame",
            generateAudio: Boolean(payload.generate_audio),
          });
        } else {
          const styledRefs: string[] = [];
          for (const u of input.referenceImageUrls || []) {
            try {
              styledRefs.push(await stylizeReferenceImage(u));
            } catch {
              styledRefs.push(u);
            }
          }
          payload = buildCreatePayload(rewritten, {
            frameUrl: null,
            referenceUrls: styledRefs,
            generateAudio: Boolean(payload.generate_audio),
          });
        }
        ({ res, data } = await postCreateTask(payload, catalogModelId));
      } catch (styleErr) {
        console.warn(
          "[veronix] privacy retry failed:",
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

export async function getBytePlusVideoTask(
  taskId: string,
  catalogModelId?: string | null,
): Promise<BytePlusTask> {
  const res = await fetch(
    `${getBytePlusBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: authHeaders(catalogModelId),
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
  if (typeof task.error === "string" && task.error.trim()) return task.error;
  if (task.error && typeof task.error === "object") {
    const msg = String(task.error.message || task.error.code || "").trim();
    if (msg) return msg;
  }
  const raw = task.raw as
    | {
        error?: { message?: string; code?: string } | string;
        message?: string;
      }
    | undefined;
  if (raw?.error) {
    if (typeof raw.error === "string" && raw.error.trim()) return raw.error;
    if (typeof raw.error === "object") {
      const msg = String(raw.error.message || raw.error.code || "").trim();
      if (msg) return msg;
    }
  }
  if (typeof raw?.message === "string" && raw.message.trim()) return raw.message;
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
    catalogModelId?: string | null;
  },
): Promise<BytePlusTask> {
  const timeoutMs = options?.timeoutMs ?? 240_000;
  const intervalMs = options?.intervalMs ?? 5_000;
  const started = Date.now();
  let currentId = taskId;
  let mutedRetryUsed = false;
  let privacyRetryUsed = false;
  let privacyDropUsed = false;
  const catalogModelId =
    options?.catalogModelId ?? options?.retryInput?.catalogModelId;

  while (Date.now() - started < timeoutMs) {
    const task = await getBytePlusVideoTask(currentId, catalogModelId);
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
        options?.retryInput &&
        isInputImagePrivacyError(err)
      ) {
        privacyRetryUsed = true;
        // Second pass of the frozen AI digital filter (same numbers) + prompt rewrite.
        const semiPrompt = toSemiRealisticScenePrompt(options.retryInput.prompt);
        try {
          if (options.retryInput.startFrameUrl) {
            const styled = await stylizeReferenceImage(
              options.retryInput.startFrameUrl,
            );
            const retry = await createBytePlusVideoTask({
              ...options.retryInput,
              prompt: semiPrompt,
              startFrameUrl: styled,
              referenceImageUrls: [],
              imageRole: "first_frame",
            });
            currentId = retry.id;
            continue;
          }
          if (options.retryInput.referenceImageUrls?.length) {
            const styledRefs: string[] = [];
            for (const u of options.retryInput.referenceImageUrls) {
              try {
                styledRefs.push(await stylizeReferenceImage(u));
              } catch {
                styledRefs.push(u);
              }
            }
            const retry = await createBytePlusVideoTask({
              ...options.retryInput,
              prompt: semiPrompt,
              startFrameUrl: undefined,
              referenceImageUrls: styledRefs,
              imageRole: "reference_image",
            });
            currentId = retry.id;
            continue;
          }
        } catch {
          // Fall through to drop-frame retry.
        }
      }
      if (
        !privacyDropUsed &&
        options?.retryInput &&
        isInputImagePrivacyError(err) &&
        // NEVER drop uploaded character stills — that produces a faceless clip
        // and looks like character binding failed. Only drop when there were
        // no character refs / start frame to preserve.
        !options.retryInput.referenceImageUrls?.length &&
        !options.retryInput.startFrameUrl &&
        privacyRetryUsed
      ) {
        privacyDropUsed = true;
        const retry = await createBytePlusVideoTask({
          ...options.retryInput,
          prompt: toSemiRealisticScenePrompt(options.retryInput.prompt),
          startFrameUrl: undefined,
          referenceImageUrls: [],
          imageRole: undefined,
          generateAudio: false,
        });
        currentId = retry.id;
        continue;
      }
      return task;
    }
    await sleep(intervalMs);
  }

  return getBytePlusVideoTask(currentId, catalogModelId);
}
