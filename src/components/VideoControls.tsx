"use client";

import type { VideoDuration, VideoQuality } from "@/lib/types";

interface VideoControlsProps {
  duration: VideoDuration;
  quality: VideoQuality;
  onDurationChange: (value: VideoDuration) => void;
  onQualityChange: (value: VideoQuality) => void;
}

export function VideoControls({
  duration,
  quality,
  onDurationChange,
  onQualityChange,
}: VideoControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          className="w-full appearance-none rounded-xl border border-white/10 bg-[rgba(8,10,14,0.85)] px-3 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]/50"
        >
          <option value="standard">Standard 720p</option>
          <option value="pro">Pro 1080p</option>
        </select>
      </label>
    </div>
  );
}
