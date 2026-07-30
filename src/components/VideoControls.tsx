"use client";

import type { VideoDuration, VideoQuality } from "@/lib/types";

interface VideoControlsProps {
  duration: VideoDuration;
  quality: VideoQuality;
  onDurationChange: (value: VideoDuration) => void;
  onQualityChange: (value: VideoQuality) => void;
}

const DURATIONS: Array<{ value: VideoDuration; label: string }> = [
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
];

const QUALITIES: Array<{ value: VideoQuality; label: string }> = [
  { value: "standard", label: "720p" },
  { value: "pro", label: "1080p" },
];

export function VideoControls({
  duration,
  quality,
  onDurationChange,
  onQualityChange,
}: VideoControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-medium text-white/80">Video Duration</p>
        <div className="grid grid-cols-2 gap-2">
          {DURATIONS.map((item) => {
            const active = duration === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onDurationChange(item.value)}
                className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--accent)] text-[#06140f]"
                    : "border border-white/12 bg-white/[0.04] text-white/75 hover:border-white/25 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-white/80">Video Quality</p>
        <div className="grid grid-cols-2 gap-2">
          {QUALITIES.map((item) => {
            const active = quality === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onQualityChange(item.value)}
                className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--accent)] text-[#06140f]"
                    : "border border-white/12 bg-white/[0.04] text-white/75 hover:border-white/25 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
