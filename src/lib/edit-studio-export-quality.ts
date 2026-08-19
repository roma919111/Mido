import type { EditStudioAspect } from "@/lib/edit-studio-draft";

export type EditStudioExportQuality = "standard" | "high";

export const EDIT_EXPORT_QUALITY_KEY = "veronix_edit_export_quality";

const STANDARD_ASPECT: Record<EditStudioAspect, string> = {
  "16:9": "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
  "9:16": "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
  "1:1": "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080",
};

/** High quality: fit inside target box — never upscale (avoids soft/blur on 720p AI clips). */
const HIGH_ASPECT: Record<EditStudioAspect, string> = {
  "16:9":
    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
  "9:16":
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
  "1:1":
    "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2",
};

export function normalizeExportQuality(value: unknown): EditStudioExportQuality {
  return value === "high" ? "high" : "standard";
}

export function aspectFfmpegScale(
  aspect: EditStudioAspect,
  quality: EditStudioExportQuality,
): string {
  return (quality === "high" ? HIGH_ASPECT : STANDARD_ASPECT)[aspect];
}

export function ffmpegEncodeFlags(quality: EditStudioExportQuality): {
  preset: string;
  crf: string;
  audioBitrate: string;
} {
  if (quality === "high") {
    return { preset: "veryfast", crf: "17", audioBitrate: "192k" };
  }
  return { preset: "ultrafast", crf: "23", audioBitrate: "128k" };
}

export function readStoredExportQuality(): EditStudioExportQuality {
  if (typeof window === "undefined") return "standard";
  try {
    return normalizeExportQuality(localStorage.getItem(EDIT_EXPORT_QUALITY_KEY));
  } catch {
    return "standard";
  }
}

export function storeExportQuality(quality: EditStudioExportQuality) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EDIT_EXPORT_QUALITY_KEY, quality);
  } catch {
    // ignore
  }
}
