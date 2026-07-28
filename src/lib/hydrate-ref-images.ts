/**
 * Make character stills reliably visible after Assets → Edit.
 * Converts /generations and remote URLs into compact JPEG data URLs
 * so previews don't go black when the original path is missing/truncated.
 */

import type { VisualReference } from "@/lib/types";

async function blobToJpegDataUrl(
  blob: Blob,
  maxEdge = 720,
  quality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export async function hydrateRefImageUrl(url: string): Promise<string | null> {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) {
    // Re-encode huge data URLs so sessionStorage can hold them.
    if (trimmed.length < 400_000) return trimmed;
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      return await blobToJpegDataUrl(blob);
    } catch {
      return trimmed;
    }
  }
  try {
    const res = await fetch(trimmed, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return await blobToJpegDataUrl(blob);
  } catch {
    return null;
  }
}

export async function hydrateReferenceImages(
  refs: VisualReference[] | undefined | null,
): Promise<VisualReference[]> {
  if (!Array.isArray(refs) || !refs.length) return [];
  const out: VisualReference[] = [];
  for (const ref of refs.slice(0, 4)) {
    if (!ref?.url) continue;
    const url = await hydrateRefImageUrl(ref.url);
    if (!url) continue;
    out.push({
      type: "image",
      id: ref.id || `ref-${out.length + 1}`,
      url,
      label: ref.label || "",
    });
  }
  return out;
}
