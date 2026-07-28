"use client";

import { useEffect, useState } from "react";

/**
 * Visual stopwatch for generate UI.
 * Hand spins via CSS (GPU). Digits update every 250ms only.
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

export function fastDisplaySeconds(startedAtMs: number, nowMs = Date.now()): number {
  const wallMs = Math.max(0, nowMs - startedAtMs);
  return wallMs / (1000 / 12);
}

type GenerateClockProps = {
  startedAt: number;
  size?: "large" | "compact";
  className?: string;
};

export function GenerateClock({
  startedAt,
  size = "large",
  className = "",
}: GenerateClockProps) {
  const safeStart =
    Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now();
  const [label, setLabel] = useState(() =>
    formatFastClock(fastDisplaySeconds(safeStart)),
  );

  useEffect(() => {
    const tick = () =>
      setLabel(formatFastClock(fastDisplaySeconds(safeStart)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [safeStart]);

  if (size === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-2 py-0.5 ${className}`}
        aria-label={`عداد التوليد ${label}`}
      >
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#22f0ff]/80 bg-black/40">
          <span
            className="vyronix-clock-hand absolute left-1/2 top-1/2 h-[8px] w-[1.5px] rounded-full bg-[#22f0ff]"
            style={{ transformOrigin: "50% 100%" }}
          />
          <span className="absolute h-1 w-1 rounded-full bg-white" />
        </span>
        <span className="font-mono text-xs font-bold tabular-nums tracking-wider text-[#22f0ff]">
          {label}
        </span>
      </span>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 ${className}`}
      aria-label={`عداد التوليد ${label}`}
    >
      <div className="relative h-[140px] w-[140px]">
        <svg
          width={140}
          height={140}
          viewBox="0 0 140 140"
          className="drop-shadow-[0_0_14px_rgba(34,240,255,0.4)]"
        >
          <circle
            cx="70"
            cy="70"
            r="63"
            fill="rgba(0,0,0,0.55)"
            stroke="rgba(34,240,255,0.4)"
            strokeWidth="2"
          />
          <circle
            cx="70"
            cy="70"
            r="58"
            fill="none"
            stroke="rgba(34,240,255,0.65)"
            strokeWidth="3.5"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            const x1 = 70 + Math.cos(a) * 56;
            const y1 = 70 + Math.sin(a) * 56;
            const x2 = 70 + Math.cos(a) * 46;
            const y2 = 70 + Math.sin(a) * 46;
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
          <circle cx="70" cy="70" r="5" fill="#22f0ff" />
        </svg>
        <span
          className="vyronix-clock-hand pointer-events-none absolute left-1/2 top-1/2 mt-[-42px] block h-[42px] w-[3px] rounded-full bg-[#22f0ff]"
          style={{ transformOrigin: "50% 100%" }}
        />
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
