"use client";

import { Loader2, Play } from "lucide-react";

interface GenerateButtonProps {
  label: string;
  credits: number;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function GenerateButton({
  label,
  credits,
  loading,
  disabled,
  onClick,
}: GenerateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="group relative w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] px-5 py-4 text-base font-semibold text-[#06140f] shadow-[0_18px_50px_rgba(46,230,166,0.22)] transition duration-300 hover:scale-[1.01] hover:shadow-[0_22px_60px_rgba(46,230,166,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)] transition duration-700 group-hover:translate-x-full" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
        {loading ? "Generating…" : label}
        <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-bold">
          −{credits} credits
        </span>
      </span>
    </button>
  );
}
