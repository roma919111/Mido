"use client";

import { useEffect, useRef } from "react";

function prepElapsedSeconds(startedAtMs: number, now = Date.now()): number {
  return Math.floor(Math.max(0, now - startedAtMs) / 4000);
}

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  return `${String(m).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;
}

type Props = {
  startedAt?: number;
  label?: string;
  className?: string;
};

/** Analog prep timer shown while the rental GPU is booting. */
export function StudioPrepClock({ startedAt, label, className = "" }: Props) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef(startedAt && startedAt > 0 ? startedAt : Date.now());

  useEffect(() => {
    if (startedAt && startedAt > 0) anchorRef.current = startedAt;
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled || !labelRef.current) return;
      labelRef.current.textContent = formatMmSs(prepElapsedSeconds(anchorRef.current));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative h-16 w-16 sm:h-20 sm:w-20">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 80 80"
          className="drop-shadow-[0_0_8px_rgba(34,240,255,0.25)]"
        >
          <circle cx="40" cy="40" r="36" fill="rgba(0,0,0,0.5)" stroke="rgba(34,240,255,0.35)" strokeWidth="1.5" />
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(34,240,255,0.55)" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((30 * i - 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={40 + 30 * Math.cos(a)}
                y1={40 + 30 * Math.sin(a)}
                x2={40 + 26 * Math.cos(a)}
                y2={40 + 26 * Math.sin(a)}
                stroke="rgba(34,240,255,0.7)"
                strokeWidth={i % 3 === 0 ? 1.5 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx="40" cy="40" r="2.5" fill="#22f0ff" />
        </svg>
        <span
          className="vyronix-clock-hand-slow pointer-events-none absolute left-1/2 top-1/2 mt-[-22px] block h-[22px] w-[1.5px] rounded-full bg-[#22f0ff] sm:mt-[-26px] sm:h-[26px]"
          style={{ transformOrigin: "50% 100%" }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-5">
          <span
            ref={labelRef}
            className="rounded bg-black/75 px-1 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[#22f0ff] ring-1 ring-[#22f0ff]/30 sm:text-xs"
          >
            {formatMmSs(prepElapsedSeconds(anchorRef.current))}
          </span>
        </div>
      </div>
      {label ? (
        <p className="text-center text-[11px] font-medium text-white/55">{label}</p>
      ) : null}
    </div>
  );
}
