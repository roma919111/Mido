import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisualReference } from "@/lib/types";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".jpg";
}

export function getUploadPath(uploadId: string): string {
  return path.join(UPLOAD_DIR, uploadId);
}

export function getUploadUrl(uploadId: string): string {
  return `/api/media/upload/${encodeURIComponent(uploadId)}`;
}

export async function saveUploadedImage(
  file: File,
  label: string,
): Promise<VisualReference> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const mimeType = file.type || "image/jpeg";
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extensionForMime(mimeType)}`;
  const localPath = getUploadPath(uploadId);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(localPath, bytes);

  return {
    type: "image",
    id: uploadId,
    url: getUploadUrl(uploadId),
    label,
    metadata: {
      localPath,
      mimeType,
    },
  };
}

export async function readUploadedImage(
  reference: VisualReference,
): Promise<{ data: string; mimeType: string }> {
  const localPath =
    typeof reference.metadata?.localPath === "string"
      ? reference.metadata.localPath
      : getUploadPath(reference.id);

  const buffer = await import("node:fs/promises").then((fs) => fs.readFile(localPath));
  const mimeType =
    typeof reference.metadata?.mimeType === "string"
      ? reference.metadata.mimeType
      : "image/jpeg";

  return {
    data: buffer.toString("base64"),
    mimeType,
  };
}
