/**
 * Local image/media persistence under `.data/generations` (served via /api/media/*).
 * Replaces OpenArt upload_sign for reference frames and character images.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GENERATIONS_DIR } from "@/lib/veronix-outro";
import type { VisualReference } from "@/lib/types";

function extFromContentType(contentType: string, fallback = "bin"): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return fallback;
}

export async function saveLocalImage(input: {
  bytes: Buffer;
  contentType?: string;
  label?: string;
  prefix?: string;
}): Promise<{ localPath: string; visualReference: VisualReference }> {
  await mkdir(GENERATIONS_DIR, { recursive: true });
  const ext = extFromContentType(input.contentType || "image/jpeg", "jpg");
  // Strip any extension from the label so we never write `name.jpg.jpg`.
  const safeLabel = (input.label || "upload")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 36)
    .replace(/^-|-$/g, "");
  const id = `${input.prefix || "upload"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${
    safeLabel ? `-${safeLabel}` : ""
  }`;
  const filename = `${id}.${ext}`;
  await writeFile(path.join(GENERATIONS_DIR, filename), input.bytes);
  const localPath = `/generations/${filename}`;
  const visualReference: VisualReference = {
    type: "image",
    id,
    url: localPath,
    label: input.label || "upload",
  };
  return { localPath, visualReference };
}
