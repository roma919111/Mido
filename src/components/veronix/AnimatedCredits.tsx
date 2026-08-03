"use client";

import { useEffect, useRef, useState } from "react";

/** Keeps the last rendered balance across route changes for smooth counting. */
let lastCreditsDisplay: number | null = null;

export function formatCreditsCompact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  }
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.max(0, Math.round(n)));
}

type AnimatedCreditsProps = {
  value: number;
  /** True while /me is in flight (navigation or tab focus). */
  syncing?: boolean;
  className?: string;
  title?: string;
};

/** Counts toward the live wallet balance with a short ease-out animation. */
export function AnimatedCredits({
  value,
  syncing = false,
  className = "",
  title,
}: AnimatedCreditsProps) {
  const target = Math.max(0, Math.round(value));
  const initial = lastCreditsDisplay ?? target;
  const [display, setDisplay] = useState(initial);
  const displayRef = useRef(initial);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!syncing && displayRef.current === target) {
      lastCreditsDisplay = target;
    }
  }, [syncing, target]);

  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const from = displayRef.current;
    const to = target;
    if (from === to) return;

    const duration = Math.min(900, Math.max(320, Math.abs(to - from) * 0.35));
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (to - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = to;
        setDisplay(to);
        lastCreditsDisplay = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return (
    <span
      className={`truncate transition-[color,opacity] duration-300 ${
        syncing ? "animate-pulse text-[#22f0ff]/90" : "text-white/90"
      } ${className}`}
      title={title ?? String(target)}
      aria-live="polite"
      aria-busy={syncing}
    >
      {formatCreditsCompact(display)}
    </span>
  );
}
