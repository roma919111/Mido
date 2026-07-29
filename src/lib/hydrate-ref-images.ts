/**
 * Make character stills reliably visible after Assets → Edit.
 * Local `/generations` paths are private — load via the media stream proxy,
 * then (optionally) compact to JPEG data URLs for session hand-off.
 */

import { veronixRefImageSrc } from "@/lib/media-proxy";
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

/** Prefer a same-origin fetchable URL (stream proxy for /generations). */
export function resolveRefFetchUrl(url: string): string | null {
  return veronixRefImageSrc(url);
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

  const fetchUrl = resolveRefFetchUrl(trimmed);
  if (!fetchUrl) return null;

  // Keep compact /generations paths when possible — CreateStudio can display
  // them via the stream proxy without bloating sessionStorage.
  if (trimmed.startsWith("/generations/")) {
    try {
      const res = await fetch(fetchUrl, { credentials: "same-origin" });
      if (!res.ok) return trimmed; // still pass path; UI uses proxy
      // Verify the file exists; keep the stable local path for Edit restore.
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  try {
    const res = await fetch(fetchUrl, { credentials: "same-origin" });
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

/**
 * Character stills for Assets → Edit draft. Prefer compact `/generations`
 * (and http) paths so sessionStorage is not blown by JPEG data URLs.
 * Falls back to the original saved URLs when hydrate fails.
 */
export async function prepareCharacterRefsForEdit(
  refs: VisualReference[] | undefined | null,
): Promise<VisualReference[]> {
  if (!Array.isArray(refs) || !refs.length) return [];
  const saved = refs
    .filter(
      (r) =>
        r?.url &&
        !/^(start-frame|start-from|edit-start)/i.test(
          String(r.label || r.id || ""),
        ),
    )
    .slice(0, 4);
  if (!saved.length) return [];

  const hydrated = await hydrateReferenceImages(saved);
  const byId = new Map(hydrated.map((r) => [r.id, r]));

  return saved.map((r, i) => {
    const id = r.id || `edit-ref-${i}`;
    const fromHydrate = byId.get(id) || hydrated[i];
    const raw = (r.url || "").trim();
    // Keep stable local / remote paths — avoid huge data URLs in the draft.
    const preferCompact =
      raw.startsWith("/generations/") ||
      /^https?:\/\//i.test(raw) ||
      (raw.startsWith("data:image/") && raw.length < 180_000);
    const url = preferCompact
      ? raw
      : fromHydrate?.url &&
          (!fromHydrate.url.startsWith("data:image/") ||
            fromHydrate.url.length < 180_000)
        ? fromHydrate.url
        : raw;
    return {
      type: "image" as const,
      id,
      url,
      label: r.label || fromHydrate?.label || "",
    };
  });
}
