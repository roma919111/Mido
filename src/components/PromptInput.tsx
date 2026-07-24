"use client";

import { Loader2, WandSparkles } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnhance: () => void;
  enhancing: boolean;
  placeholder: string;
}

export function PromptInput({
  value,
  onChange,
  onEnhance,
  enhancing,
  placeholder,
}: PromptInputProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="prompt" className="text-sm font-medium text-white/80">
          Prompt
        </label>
        <button
          type="button"
          onClick={onEnhance}
          disabled={!value.trim() || enhancing}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-[var(--accent)]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enhancing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <WandSparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
          )}
          Enhance Prompt with AI
        </button>
      </div>

      <textarea
        id="prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-white/10 bg-[rgba(8,10,14,0.75)] px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:shadow-[0_0_0_3px_rgba(46,230,166,0.12)]"
      />
    </div>
  );
}
