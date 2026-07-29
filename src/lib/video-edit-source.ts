/**
 * Resolve Start Frame / character stills when editing a (often failed) video.
 * Prefers the persisted start frame, then character stills, then the
 * originally generated image that seeded image→video.
 */

import { stripInternalPromptNotes } from "@/lib/character-names";
import { prepareCharacterRefsForEdit } from "@/lib/hydrate-ref-images";
import type { VisualReference } from "@/lib/types";

export type EditableAssetLite = {
  id: string;
  mediaType?: string;
  status?: string;
  url?: string;
  prompt?: string;
  mode?: string;
  targetSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  preferClarity?: boolean;
  referenceImages?: Array<{
    id?: string;
    url: string;
    label?: string;
  }>;
  startFrame?: {
    id?: string;
    url: string;
    label?: string;
  } | null;
};

function promptsMatch(a: string, b: string): boolean {
  const left = stripInternalPromptNotes(a || "").trim();
  const right = stripInternalPromptNotes(b || "").trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  return norm(left) === norm(right);
}

function asStartFrame(
  raw: { id?: string; url: string; label?: string } | null | undefined,
  fallbackId: string,
): VisualReference | null {
  const url = (raw?.url || "").trim();
  if (!url) return null;
  return {
    type: "image",
    id: raw?.id || fallbackId,
    url,
    label: "start-frame",
  };
}

/** Find a completed image that matches this video's prompt (the seed still). */
export function findMatchingGeneratedImage(
  assets: EditableAssetLite[],
  prompt: string,
  excludeAssetId?: string,
): EditableAssetLite | null {
  const list = Array.isArray(assets) ? assets : [];
  return (
    list.find(
      (a) =>
        a.mediaType === "image" &&
        a.status === "completed" &&
        Boolean(a.url) &&
        a.id !== excludeAssetId &&
        promptsMatch(a.prompt || "", prompt),
    ) || null
  );
}

export type VideoEditSource = {
  startFrame: VisualReference | null;
  useAsStartFrame: boolean;
  referenceImages: VisualReference[];
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  preferClarity?: boolean;
};

/**
 * Build the Edit hand-off for a video asset (including failed image→video).
 */
export async function resolveVideoEditSource(input: {
  asset?: EditableAssetLite | null;
  assets?: EditableAssetLite[];
  prompt: string;
  /** Optional start frame URL remembered on the Create job card. */
  jobStartFrameUrl?: string | null;
  duration?: number;
}): Promise<VideoEditSource> {
  const asset = input.asset || null;
  const assets = input.assets || [];
  const prompt = stripInternalPromptNotes(input.prompt || asset?.prompt || "");
  const duration = input.duration ?? asset?.targetSeconds;
  const meta = {
    duration,
    aspectRatio: asset?.aspectRatio,
    resolution: asset?.resolution,
    preferClarity: asset?.preferClarity,
  };

  const labeledStart =
    asset?.startFrame?.url
      ? asset.startFrame
      : asset?.referenceImages?.find(
          (r) =>
            r?.url &&
            /^(start-frame|start-from|edit-start)/i.test(
              String(r.label || r.id || ""),
            ),
        );

  const startFrame =
    asStartFrame(labeledStart, `start-${asset?.id || "job"}`) ||
    asStartFrame(
      input.jobStartFrameUrl
        ? { url: input.jobStartFrameUrl, id: `start-job-${asset?.id || "x"}` }
        : null,
      `start-job-${asset?.id || "x"}`,
    );

  // 1) Explicit Start Frame (Make Video / image→video) wins.
  if (startFrame) {
    return {
      startFrame,
      useAsStartFrame: true,
      referenceImages: [],
      prompt,
      ...meta,
    };
  }

  // 2) Character stills saved on the video asset.
  const rawChars = (asset?.referenceImages || []).filter(
    (r) =>
      r?.url &&
      !/^(start-frame|start-from|edit-start)/i.test(
        String(r.label || r.id || ""),
      ),
  );

  let referenceImages: VisualReference[] = rawChars.length
    ? await prepareCharacterRefsForEdit(
        rawChars.map((r, i) => ({
          type: "image" as const,
          id: r.id || `edit-ref-${asset?.id || "x"}-${i}`,
          url: r.url,
          label: r.label || "",
        })),
      )
    : [];

  if (referenceImages.length) {
    return {
      startFrame: null,
      useAsStartFrame: false,
      referenceImages,
      prompt,
      ...meta,
    };
  }

  // 3) Failed Make Video often loses startFrame — recover the originally
  //    generated still by matching prompt against completed images.
  const seed = findMatchingGeneratedImage(assets, prompt, asset?.id);
  if (seed?.url) {
    const recovered = asStartFrame(
      { id: `seed-${seed.id}`, url: seed.url, label: "start-frame" },
      `seed-${seed.id}`,
    );
    if (recovered) {
      return {
        startFrame: recovered,
        useAsStartFrame: true,
        referenceImages: [],
        prompt,
        ...meta,
      };
    }
  }

  // 4) Last resort: character stills from the matching image asset.
  if (seed?.referenceImages?.length) {
    referenceImages = await prepareCharacterRefsForEdit(
      seed.referenceImages.map((r, i) => ({
        type: "image" as const,
        id: r.id || `seed-ref-${seed.id}-${i}`,
        url: r.url,
        label: r.label || "",
      })),
    );
  }

  return {
    startFrame: null,
    useAsStartFrame: false,
    referenceImages,
    prompt,
    ...meta,
  };
}
