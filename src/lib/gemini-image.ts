import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Modality } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini-client";
import { readUploadedImage } from "@/lib/local-upload";
import type { VisualReference } from "@/lib/types";

export { GeminiConfigError, isGeminiConfigured } from "@/lib/gemini-client";

export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

const IMAGE_DIR = path.join(process.cwd(), ".data", "gemini-images");

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getGeminiImagePath(imageId: string): string {
  return path.join(IMAGE_DIR, `${sanitizeId(imageId)}.png`);
}

export function getGeminiImageUrl(imageId: string): string {
  return `/api/media/gemini-image/${encodeURIComponent(imageId)}`;
}

async function fetchRemoteImageAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    mimeType: response.headers.get("content-type") || "image/jpeg",
  };
}

async function loadReferenceImage(
  reference: VisualReference,
): Promise<{ data: string; mimeType: string }> {
  if (reference.url.startsWith("/api/media/upload/") || reference.metadata?.localPath) {
    return readUploadedImage(reference);
  }
  return fetchRemoteImageAsBase64(reference.url);
}

function extractImageBytes(response: {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  }>;
}): Buffer | null {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
  }
  return null;
}

export async function generateGeminiImage(input: {
  prompt: string;
  referenceImage?: VisualReference | null;
}): Promise<{
  imageId: string;
  url: string;
  playbackUrl: string;
}> {
  const client = getGeminiClient();
  const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  if (input.referenceImage) {
    const image = await loadReferenceImage(input.referenceImage);
    parts.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType,
      },
    });
    parts.push({
      text: `Using the reference image as style/subject guidance, create: ${input.prompt}`,
    });
  } else {
    parts.push({ text: input.prompt });
  }

  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const bytes = extractImageBytes(response);
  if (!bytes) {
    throw new Error("Gemini did not return an image");
  }

  await mkdir(IMAGE_DIR, { recursive: true });
  await writeFile(getGeminiImagePath(imageId), bytes);

  const url = getGeminiImageUrl(imageId);
  return { imageId, url, playbackUrl: url };
}

export async function getGeminiImageStatus(imageId: string): Promise<{
  status: string;
  url?: string;
  playbackUrl?: string;
}> {
  try {
    await access(getGeminiImagePath(imageId));
    const url = getGeminiImageUrl(imageId);
    return { status: "COMPLETED", url, playbackUrl: url };
  } catch {
    return { status: "FAILED" };
  }
}
