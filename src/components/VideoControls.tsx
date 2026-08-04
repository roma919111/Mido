"use client";

import type { VideoDuration, VideoResolution } from "@/lib/types";
import { getVideoCreditsPerSecond } from "@/lib/credit-pricing";
import { VIDEO_MODEL } from "@/lib/models";
import { VIDEO_RESOLUTIONS } from "@/config/modelPricing";

interface VideoControlsProps {
  duration: VideoDuration;
  resolution: VideoResolution;
  generateAudio: boolean;
  estimatedCredits: number;
  onDurationChange: (value: VideoDuration) => void;
  onResolutionChange: (value: VideoResolution) => void;
  onGenerateAudioChange: (value: boolean) => void;
}

export function VideoControls({
  duration,
  resolution,
  generateAudio,
  estimatedCredits,
  onDurationChange,
  onResolutionChange,
  onGenerateAudioChange,
}: VideoControlsProps) {
  const rate = getVideoCreditsPerSecond(VIDEO_MODEL, resolution, generateAudio);

  return (
    <div className="space-y-4">
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
          <span className="text-sm font-medium text-white/80">Resolution</span>
          <select
            value={resolution}
            onChange={(e) => onResolutionChange(e.target.value as VideoResolution)}
            className="w-full appearance-none rounded-xl border border-white/10 bg-[rgba(8,10,14,0.85)] px-3 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]/50"
          >
            {VIDEO_RESOLUTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,14,0.85)] px-4 py-3">
        <div>
          <span className="text-sm font-medium text-white/80">Generate audio</span>
          <p className="text-xs text-white/45">Higher credit rate when enabled</p>
        </div>
        <input
          type="checkbox"
          checked={generateAudio}
          onChange={(e) => onGenerateAudioChange(e.target.checked)}
          className="h-5 w-5 rounded border-white/20 accent-[var(--accent)]"
        />
      </label>

      <div className="rounded-xl border border-[var(--accent)]/20 bg-[rgba(46,230,166,0.06)] px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-white/70">Estimated cost</span>
          <span className="font-semibold text-[var(--accent)]">
            {estimatedCredits.toLocaleString()} credits
          </span>
        </div>
        <p className="mt-1 text-xs text-white/45">
          PixVerse V6 · {rate} credits/sec × {duration}s · {resolution}
          {generateAudio ? " · with audio" : " · no audio"}
        </p>
      </div>
    </div>
  );
}
