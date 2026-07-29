"use client";

import { Loader2, Play } from "lucide-react";

interface GenerateButtonProps {
  label: string;
  credits: number;
  loading: boolean;
  hint?: string | null;
  onClick: () => void;
}

export function GenerateButton({
  label,
  credits,
  loading,
  hint,
  onClick,
}: GenerateButtonProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        disabled={loading}
        className="relative z-20 w-full rounded-2xl bg-[linear-gradient(135deg,#2ee6a6,#ffb05c)] px-5 py-5 text-lg font-bold text-[#06140f] shadow-[0_18px_50px_rgba(46,230,166,0.35)] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Play className="h-6 w-6 fill-current" />
          )}
          {loading ? "Generating…" : label}
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-bold">
            −{credits}
          </span>
        </span>
      </button>
      {hint ? <p className="text-center text-xs text-white/50">{hint}</p> : null}
    </div>
  );
}
