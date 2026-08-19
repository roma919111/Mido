"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Last settled balance — used when soft-navigating without a full remount. */
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

/**
 * Rolls the wallet number on refresh / route change / sync, then settles.
 */
export function AnimatedCredits({
  value,
  syncing = false,
  className = "",
  title,
}: AnimatedCreditsProps) {
  const pathname = usePathname();
  const target = Math.max(0, Math.round(value));
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const wasSyncing = useRef(false);
  const kickRef = useRef(0);

  const play = (from: number, to: number) => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    displayRef.current = from;
    setDisplay(from);

    if (from === to) {
      lastCreditsDisplay = to;
      return;
    }

    const duration = Math.min(950, Math.max(450, Math.abs(to - from) * 0.25));
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
  };

  const rollThenSettle = (to: number) => {
    const startFrom =
      to <= 0 ? 0 : Math.max(0, Math.round(to * (0.1 + Math.random() * 0.22)));
    play(startFrom, to);
  };

  // Hard refresh + soft navigation between pages.
  useEffect(() => {
    kickRef.current += 1;
    const kick = kickRef.current;
    const timer = window.setTimeout(() => {
      if (kick !== kickRef.current) return;
      rollThenSettle(target);
    }, 40);
    return () => {
      window.clearTimeout(timer);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // Intentionally only pathname — remount / route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Balance changed (spend / top-up) while staying on the same page.
  useEffect(() => {
    if (displayRef.current === target) {
      lastCreditsDisplay = target;
      return;
    }
    // Don't interrupt the route-entry roll unless the gap is meaningful.
    const gap = Math.abs(displayRef.current - target);
    if (gap < 1) return;
    play(displayRef.current, target);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // After /me refresh completes, roll once more onto the confirmed balance.
  useEffect(() => {
    const finished = wasSyncing.current && !syncing;
    wasSyncing.current = syncing;
    if (!finished) return;
    rollThenSettle(target);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing]);

  return (
    <span
      className={`truncate tabular-nums transition-[color,opacity] duration-300 ${
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
