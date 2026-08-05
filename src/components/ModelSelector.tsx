"use client";

import { Sparkles } from "lucide-react";
import {
  GEMINI_IMAGE_MODEL_ID,
  GEMINI_VIDEO_MODEL_ID,
  getModelLabel,
} from "@/lib/models";
import type { GenerationMode } from "@/lib/types";

interface ModelSelectorProps {
  mode: GenerationMode;
}

const MODEL_DETAILS: Record<
  "image" | "video",
  { label: string; description: string; provider: string }
> = {
  image: {
    label: "Gemini 2.5 Flash Image",
    description: "Fast text-to-image and image-to-image via Google Gemini",
    provider: GEMINI_IMAGE_MODEL_ID,
  },
  video: {
    label: "Gemini Omni Flash",
    description: "Cinematic video with audio · 720p · Google Gemini Interactions API",
    provider: GEMINI_VIDEO_MODEL_ID,
  },
};

export function ModelSelector({ mode }: ModelSelectorProps) {
  const isVideo = mode !== "text-to-image";
  const details = isVideo ? MODEL_DETAILS.video : MODEL_DETAILS.image;
  const modelId = getModelLabel(mode);

  return (
    <div className="rounded-2xl border border-[rgba(46,230,166,0.25)] bg-[rgba(46,230,166,0.06)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]/80">
            AI Model
          </p>
          <p className="text-base font-semibold text-white">{details.label}</p>
          <p className="text-sm text-white/50">{details.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
          <Sparkles className="h-3 w-3" />
          Google Gemini
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] text-white/35">{modelId}</p>
    </div>
  );
}
