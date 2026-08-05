"use client";

import type { VideoDuration, VideoModel, VideoQuality } from "@/lib/types";
import { VIDEO_MODEL_OPTIONS } from "@/lib/models";

interface VideoControlsProps {
  duration: VideoDuration;
  quality: VideoQuality;
  videoModel: VideoModel;
  onDurationChange: (value: VideoDuration) => void;
  onQualityChange: (value: VideoQuality) => void;
  onVideoModelChange: (value: VideoModel) => void;
}

export function VideoControls({
  duration,
  quality,
  videoModel,
  onDurationChange,
  onQualityChange,
  onVideoModelChange,
}: VideoControlsProps) {
  const isGemini = videoModel === "gemini-omni";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 sm:col-span-2 xl:col-span-1">
        <span className="text-sm font-medium text-white/80">Video Model</span>
        <select
          value={videoModel}
          onChange={(e) => onVideoModelChange(e.target.value as VideoModel)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-[rgba(8,10,14,0.85)] px-3 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]/50"
        >
          {(Object.entries(VIDEO_MODEL_OPTIONS) as [VideoModel, (typeof VIDEO_MODEL_OPTIONS)[VideoModel]][]).map(
            ([id, option]) => (
              <option key={id} value={id}>
                {option.label} · {option.description}
              </option>
            ),
          )}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-white/80">Video Duration</span>
        <select
          value={duration}
          onChange={(e) => onDurationChange(Number(e.target.value) as VideoDuration)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-[rgba(8,10,14,0.85)] px-3 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]/50"
        >
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-white/80">Video Quality / Resolution</span>
        <select
          value={quality}
          onChange={(e) => onQualityChange(e.target.value as VideoQuality)}
          disabled={isGemini}
          className="w-full appearance-none rounded-xl border border-white/10 bg-[rgba(8,10,14,0.85)] px-3 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="standard">Standard 720p</option>
          {!isGemini && <option value="pro">Pro 1080p</option>}
        </select>
        {isGemini && (
          <p className="text-xs text-white/40">Gemini Omni Flash outputs 720p video with audio.</p>
        )}
      </label>
    </div>
  );
}
