"use client";

import { Clapperboard, ImageIcon, Images } from "lucide-react";
import type { GenerationMode } from "@/lib/types";

const MODES: Array<{
  id: GenerationMode;
  label: string;
  icon: typeof ImageIcon;
}> = [
  { id: "text-to-image", label: "Text-to-Image", icon: ImageIcon },
  { id: "text-to-video", label: "Text-to-Video", icon: Clapperboard },
  { id: "image-to-video", label: "Image-to-Video", icon: Images },
];

interface ModeSwitcherProps {
  mode: GenerationMode;
  onChange: (mode: GenerationMode) => void;
}

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div className="relative z-20 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 sm:grid-cols-3">
      {MODES.map((item) => {
        const active = mode === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`relative flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition duration-300 ${
              active
                ? "bg-[var(--surface-elevated)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                : "cursor-pointer text-white/70 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {active && (
              <span className="pointer-events-none absolute inset-x-4 -bottom-px h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
            )}
            <Icon className={`h-4 w-4 ${active ? "text-[var(--accent)]" : ""}`} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
