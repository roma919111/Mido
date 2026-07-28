"use client";

import { useEffect, useState } from "react";

/**
 * Visual stopwatch for generate UI.
 * - Circular clock face (شكل ساعة)
 * - Counts UP (not countdown)
 * - Display seconds advance ~12× wall time so motion feels very fast
 */

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function formatFastClock(displaySec: number): string {
  const total = Math.max(0, Math.floor(displaySec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

/** Accelerated upward seconds from a wall-clock start. */
export function fastDisplaySeconds(startedAtMs: number, nowMs = Date.now()): number {
  const wallMs = Math.max(0, nowMs - startedAtMs);
  // ~12 display-seconds per real second.
  return wallMs / (1000 / 12);
}

type GenerateClockProps = {
  startedAt: number;
  /** large = card center, compact = header chip */
  size?: "large" | "compact";
  className?: string;
};

export function GenerateClock({
  startedAt,
  size = "large",
  className = "",
}: GenerateClockProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(id);
  }, []);

  const safeStart =
    Number.isFinite(startedAt) && startedAt > 0 ? startedAt : now;
  const display = fastDisplaySeconds(safeStart, now);
  const whole = Math.floor(display);
  const frac = display - whole;
  const handDeg = (whole % 60) * 6 + frac * 6;
  const label = formatFastClock(whole);

  if (size === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-2 py-0.5 ${className}`}
        aria-label={`عداد التوليد ${label}`}
      >
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#22f0ff]/80 bg-black/40">
          <span
            className="absolute left-1/2 top-1/2 h-[8px] w-[1.5px] rounded-full bg-[#22f0ff]"
            style={{
              transformOrigin: "50% 100%",
              transform: `translate(-50%, -100%) rotate(${handDeg}deg)`,
            }}
          />
          <span className="absolute h-1 w-1 rounded-full bg-white" />
        </span>
        <span className="font-mono text-xs font-bold tabular-nums tracking-wider text-[#22f0ff]">
          {label}
        </span>
      </span>
    );
  }

  const dim = 140;
  const cx = dim / 2;
  const cy = dim / 2;
  const r = 58;
  const handLen = 42;
  const rad = ((handDeg - 90) * Math.PI) / 180;
  const hx = cx + Math.cos(rad) * handLen;
  const hy = cy + Math.sin(rad) * handLen;

  return (
    <div
      className={`flex flex-col items-center gap-2 ${className}`}
      aria-label={`عداد التوليد ${label}`}
    >
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="drop-shadow-[0_0_14px_rgba(34,240,255,0.4)]"
        >
          <circle
            cx={cx}
            cy={cy}
            r={r + 5}
            fill="rgba(0,0,0,0.55)"
            stroke="rgba(34,240,255,0.4)"
            strokeWidth="2"
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(34,240,255,0.65)"
            strokeWidth="3.5"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            const x1 = cx + Math.cos(a) * (r - 2);
            const y1 = cy + Math.sin(a) * (r - 2);
            const x2 = cx + Math.cos(a) * (r - 12);
            const y2 = cy + Math.sin(a) * (r - 12);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(34,240,255,0.85)"
                strokeWidth={i % 3 === 0 ? 3 : 1.5}
                strokeLinecap="round"
              />
            );
          })}
          <line
            x1={cx}
            y1={cy}
            x2={hx}
            y2={hy}
            stroke="#22f0ff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill="#22f0ff" />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-10">
          <span className="rounded-lg bg-black/65 px-2.5 py-1 font-mono text-xl font-black tabular-nums tracking-widest text-[#22f0ff] ring-1 ring-[#22f0ff]/35">
            {label}
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold text-white/75">عداد التوليد</p>
    </div>
  );
}
