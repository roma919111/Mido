import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { GenerationMode, VideoDuration, VisualReference } from "@/lib/types";

export const GEMINI_VIDEO_MODEL =
  process.env.GEMINI_VIDEO_MODEL?.trim() || "gemini-omni-flash-preview";

const VIDEO_DIR = path.join(process.cwd(), ".data", "gemini-videos");

type GeminiInteraction = {
  id?: string;
  status?: string;
  error?: string;
  output_video?: { data?: string; uri?: string };
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; data?: string; uri?: string }>;
  }>;
};

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not configured on the server. Add it to your environment variables.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function sanitizeInteractionId(interactionId: string): string {
  return interactionId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getGeminiVideoPath(interactionId: string): string {
  return path.join(VIDEO_DIR, `${sanitizeInteractionId(interactionId)}.mp4`);
}

export function getGeminiVideoUrl(interactionId: string): string {
  return `/api/media/gemini/${encodeURIComponent(interactionId)}`;
}

async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return { data: buffer.toString("base64"), mimeType };
}

type GeminiInputPart =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mime_type: string }
    >;

async function buildGeminiInput(
  mode: GenerationMode,
  prompt: string,
  startFrame?: VisualReference | null,
  referenceImage?: VisualReference | null,
): Promise<GeminiInputPart> {
  const parts: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mime_type: string }
  > = [];

  if (mode === "image-to-video" && startFrame?.url) {
    const image = await fetchImageAsBase64(startFrame.url);
    parts.push({ type: "image", data: image.data, mime_type: image.mimeType });
  } else if (referenceImage?.url) {
    const image = await fetchImageAsBase64(referenceImage.url);
    parts.push({ type: "image", data: image.data, mime_type: image.mimeType });
  }

  parts.push({ type: "text", text: prompt });
  return parts.length === 1 ? prompt : parts;
}

function mapVideoTask(
  mode: GenerationMode,
  hasStartFrame: boolean,
  hasReference: boolean,
): "text_to_video" | "image_to_video" | "reference_to_video" {
  if (mode === "image-to-video" || hasStartFrame) return "image_to_video";
  if (hasReference) return "reference_to_video";
  return "text_to_video";
}

function extractVideoPayload(interaction: GeminiInteraction): {
  data?: Buffer;
  uri?: string;
} {
  if (interaction.output_video?.data) {
    return { data: Buffer.from(interaction.output_video.data, "base64") };
  }

  if (interaction.output_video?.uri) {
    return { uri: interaction.output_video.uri };
  }

  for (const step of interaction.steps ?? []) {
    if (step.type !== "model_output" || !step.content) continue;
    for (const part of step.content) {
      if (part.type !== "video") continue;
      if ("data" in part && typeof part.data === "string" && part.data) {
        return { data: Buffer.from(part.data, "base64") };
      }
      if ("uri" in part && typeof part.uri === "string" && part.uri) {
        return { uri: part.uri };
      }
    }
  }

  return {};
}

async function persistVideo(interactionId: string, source: { data?: Buffer; uri?: string }) {
  await mkdir(VIDEO_DIR, { recursive: true });
  const filePath = getGeminiVideoPath(interactionId);

  if (source.data) {
    await writeFile(filePath, source.data);
    return;
  }

  if (source.uri) {
    const response = await fetch(source.uri, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to download Gemini video (${response.status})`);
    }
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    return;
  }

  throw new Error("Gemini interaction completed without video data");
}

async function ensureStoredVideo(interactionId: string, interaction: GeminiInteraction) {
  const filePath = getGeminiVideoPath(interactionId);
  try {
    await access(filePath);
    return;
  } catch {
    // not stored yet
  }

  const payload = extractVideoPayload(interaction);
  await persistVideo(interactionId, payload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollGeminiInteraction(
  interactionId: string,
  options?: { attempts?: number; intervalMs?: number },
): Promise<GeminiInteraction> {
  const client = getClient();
  const attempts = options?.attempts ?? 60;
  const intervalMs = options?.intervalMs ?? 5000;

  for (let i = 0; i < attempts; i += 1) {
    const interaction = (await client.interactions.get(interactionId)) as GeminiInteraction;
    const status = String(interaction.status ?? "").toLowerCase();

    if (status === "completed") return interaction;
    if (["failed", "cancelled", "canceled", "error"].includes(status)) {
      throw new Error(
        String(interaction.error ?? interaction.status ?? "Gemini video generation failed"),
      );
    }

    await sleep(intervalMs);
  }

  throw new Error("Gemini video generation timed out while waiting for completion");
}

export async function generateGeminiVideo(input: {
  mode: GenerationMode;
  prompt: string;
  duration: VideoDuration;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
}): Promise<{
  interactionId: string;
  status: string;
  url: string;
  playbackUrl: string;
}> {
  const client = getClient();
  const geminiInput = await buildGeminiInput(
    input.mode,
    input.prompt,
    input.startFrame,
    input.referenceImage,
  );

  const task = mapVideoTask(
    input.mode,
    Boolean(input.startFrame?.url),
    Boolean(input.referenceImage?.url),
  );

  const interaction = (await client.interactions.create({
    model: GEMINI_VIDEO_MODEL,
    input: geminiInput,
    response_modalities: ["video"],
    generation_config: {
      max_output_tokens: 65536,
      thinking_level: "high",
      video_config: { task },
    },
    response_format: {
      type: "video",
      duration: `${input.duration}s`,
      aspect_ratio: "16:9",
      delivery: "uri",
    },
  })) as GeminiInteraction;

  const interactionId = interaction.id;
  if (!interactionId) {
    throw new Error("Gemini did not return an interaction id");
  }

  const completed: GeminiInteraction =
    String(interaction.status ?? "").toLowerCase() === "completed"
      ? interaction
      : await pollGeminiInteraction(interactionId, { attempts: 48, intervalMs: 5000 });

  await ensureStoredVideo(interactionId, completed);

  const url = getGeminiVideoUrl(interactionId);
  return {
    interactionId,
    status: "COMPLETED",
    url,
    playbackUrl: url,
  };
}

export async function getGeminiVideoStatus(interactionId: string): Promise<{
  status: string;
  url?: string;
  playbackUrl?: string;
  error?: string;
}> {
  try {
    const filePath = getGeminiVideoPath(interactionId);
    try {
      await access(filePath);
      const url = getGeminiVideoUrl(interactionId);
      return { status: "COMPLETED", url, playbackUrl: url };
    } catch {
      // still generating or not saved yet
    }

    const client = getClient();
    const interaction = (await client.interactions.get(interactionId)) as GeminiInteraction;
    const status = String(interaction.status ?? "UNKNOWN").toUpperCase();

    if (status === "COMPLETED") {
      await ensureStoredVideo(interactionId, interaction);
      const url = getGeminiVideoUrl(interactionId);
      return { status, url, playbackUrl: url };
    }

    if (["FAILED", "CANCELLED", "ERROR"].includes(status)) {
      return {
        status,
        error: String(interaction.error ?? "Gemini video generation failed"),
      };
    }

    return { status: status || "RUNNING" };
  } catch (error) {
    return {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Gemini status check failed",
    };
  }
}
