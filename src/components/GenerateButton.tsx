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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a0d13] px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] px-5 py-4 text-base font-semibold text-[#06140f] shadow-[0_18px_50px_rgba(46,230,166,0.35)] transition duration-300 active:scale-[0.99] hover:scale-[1.01] disabled:cursor-wait disabled:opacity-80"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
          {loading ? "Generating…" : label}
          <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-bold">
            −{credits} credits
          </span>
        </span>
      </button>
      {hint ? (
        <p className="mt-2 text-center text-xs text-white/55 sm:text-white/45">{hint}</p>
      ) : null}
    </div>
  );
}
