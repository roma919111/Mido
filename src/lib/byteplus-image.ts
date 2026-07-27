/**
 * BytePlus ModelArk — Seedream image generation (VYRONIX Image Studio).
 */

import {
  getBytePlusApiKey,
  getBytePlusBaseUrl,
  isBytePlusConfigured,
  resolvePublicMediaUrl,
} from "@/lib/byteplus-ark";
import type { VisualReference } from "@/lib/types";

/** Customer-facing catalog id (UI name = VYRONIX). */
export const VERONIX_IMAGE_MODEL_ID = "vyronix-image";

const DEFAULT_IMAGE_MODEL = "seedream-4-5-251128";

export function getBytePlusImageModelId(): string {
  return (
    process.env.BYTEPLUS_IMAGE_MODEL?.trim() ||
    process.env.ARK_IMAGE_MODEL?.trim() ||
    DEFAULT_IMAGE_MODEL
  );
}

export type BytePlusImageInput = {
  prompt: string;
  /** Seedream size enum, e.g. 2K / 1K */
  size?: string;
  /** Never show provider watermark on customer outputs */
  watermark?: boolean;
  /** Optional reference still for image-to-image */
  referenceUrl?: string | null;
};

export type BytePlusImageResult = {
  url: string;
  model: string;
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

export async function createBytePlusImage(
  input: BytePlusImageInput,
): Promise<BytePlusImageResult> {
  if (!isBytePlusConfigured()) {
    throw new Error("BYTEPLUS_API_KEY is not configured");
  }

  const model = getBytePlusImageModelId();
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    sequential_image_generation: "disabled",
    response_format: "url",
    size: input.size || "2K",
    stream: false,
    // Product requirement: no visible watermark on VYRONIX outputs.
    watermark: input.watermark === true ? true : false,
  };

  if (input.referenceUrl?.trim()) {
    // Seedream i2i — pass reference when the build accepts it.
    body.image = input.referenceUrl.trim();
  }

  const res = await fetch(`${getBytePlusBaseUrl()}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { rawText: text };
  }

  // Retry without `image` if i2i field is rejected.
  if (!res.ok && body.image) {
    const msg =
      (data.error as { message?: string } | undefined)?.message ||
      String(data.message || "");
    if (/image|unknown|invalid|not support/i.test(msg) || res.status === 400) {
      const { image: _drop, ...rest } = body;
      const retry = await fetch(`${getBytePlusBaseUrl()}/images/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(rest),
      });
      const retryText = await retry.text();
      try {
        data = JSON.parse(retryText) as Record<string, unknown>;
      } catch {
        data = { rawText: retryText };
      }
      if (!retry.ok) {
        const err =
          (data.error as { message?: string } | undefined)?.message ||
          `BytePlus image failed (${retry.status})`;
        throw new Error(err);
      }
    } else {
      const err =
        (data.error as { message?: string } | undefined)?.message ||
        `BytePlus image failed (${res.status})`;
      throw new Error(err);
    }
  } else if (!res.ok) {
    const err =
      (data.error as { message?: string } | undefined)?.message ||
      `BytePlus image failed (${res.status})`;
    throw new Error(err);
  }

  const list = (data.data as Array<{ url?: string }> | undefined) || [];
  const url =
    list.find((item) => typeof item?.url === "string" && item.url)?.url ||
    (typeof data.url === "string" ? data.url : null);

  if (!url) {
    throw new Error("BytePlus image returned no URL");
  }

  return { url, model, raw: data };
}

/** Resolve first usable character/ref still for optional i2i. */
export function resolveImageReference(
  refs: VisualReference[] | undefined | null,
): string | null {
  if (!refs?.length) return null;
  for (const ref of refs) {
    const url = resolvePublicMediaUrl(ref);
    if (url) return url;
  }
  return null;
}
