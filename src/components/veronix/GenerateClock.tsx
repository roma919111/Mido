"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight stopwatch — updates digits via DOM (no React re-render storm).
 * Hand spins with CSS. Safe with many cards / Chrome main thread.
 */

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function formatFastTimer(displaySec: number): string {
  const totalCs = Math.max(0, Math.floor(displaySec * 100));
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

/** ~20 display-seconds per real second (racing timer feel). */
export function fastDisplaySeconds(startedAtMs: number, nowMs = Date.now()): number {
  const wallMs = Math.max(0, nowMs - startedAtMs);
  return wallMs / (1000 / 20);
}

type GenerateClockProps = {
  startedAt: number;
  size?: "large" | "compact";
  className?: string;
  /** When false, timer and hand freeze (generation done, media still loading). */
  running?: boolean;
  /** Wall-clock ms to freeze at when `running` is false. */
  frozenAt?: number;
};

export function GenerateClock({
  startedAt,
  size = "large",
  className = "",
  running = true,
  frozenAt,
}: GenerateClockProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const safeStart =
    Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now();
  const freezeWall =
    typeof frozenAt === "number" && frozenAt > 0 ? frozenAt : Date.now();

  useEffect(() => {
    let cancelled = false;
    let lastShown = "";

    const paint = () => {
      if (cancelled || !labelRef.current) return;
      if (running && typeof document !== "undefined" && document.hidden) return;
      const nowMs = running ? Date.now() : freezeWall;
      const next = formatFastTimer(fastDisplaySeconds(safeStart, nowMs));
      if (next !== lastShown) {
        lastShown = next;
        labelRef.current.textContent = next;
      }
    };

    paint();
    if (!running) return () => {
      cancelled = true;
    };

    const id = window.setInterval(paint, 120);
    const onVis = () => {
      if (!document.hidden) paint();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [safeStart, running, freezeWall]);

  const initial = formatFastTimer(
    fastDisplaySeconds(safeStart, running ? Date.now() : freezeWall),
  );
  const handStyle = {
    transformOrigin: "50% 100%",
    animationPlayState: running ? ("running" as const) : ("paused" as const),
  };

  if (size === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-1.5 py-0.5 ${className}`}
        aria-live="off"
      >
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#22f0ff]/80 bg-black/40">
          <span
            className="vyronix-clock-hand absolute left-1/2 top-1/2 h-[6px] w-[1.5px] rounded-full bg-[#22f0ff]"
            style={handStyle}
          />
          <span className="absolute h-0.5 w-0.5 rounded-full bg-white" />
        </span>
        <span
          ref={labelRef}
          className="font-mono text-[10px] font-bold tabular-nums tracking-tight text-[#22f0ff]"
        >
          {initial}
        </span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div className="relative h-24 w-24">
        <svg
          width={96}
          height={96}
          viewBox="0 0 96 96"
          className="drop-shadow-[0_0_10px_rgba(34,240,255,0.35)]"
        >
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="rgba(0,0,0,0.55)"
            stroke="rgba(34,240,255,0.4)"
            strokeWidth="1.5"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke="rgba(34,240,255,0.65)"
            strokeWidth="2.5"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={48 + Math.cos(a) * 38}
                y1={48 + Math.sin(a) * 38}
                x2={48 + Math.cos(a) * 32}
                y2={48 + Math.sin(a) * 32}
                stroke="rgba(34,240,255,0.85)"
                strokeWidth={i % 3 === 0 ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx="48" cy="48" r="3.5" fill="#22f0ff" />
        </svg>
        <span
          className="vyronix-clock-hand pointer-events-none absolute left-1/2 top-1/2 mt-[-28px] block h-[28px] w-[2px] rounded-full bg-[#22f0ff]"
          style={handStyle}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-7">
          <span
            ref={labelRef}
            className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-sm font-black tabular-nums tracking-tight text-[#22f0ff] ring-1 ring-[#22f0ff]/35"
          >
            {initial}
          </span>
        </div>
      </div>
      <p className="text-[10px] font-semibold text-white/70">عداد التوليد</p>
    </div>
  );
}
