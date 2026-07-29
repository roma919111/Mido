/**
 * Lightweight stopwatch — updates digits via DOM (no React re-render storm).
 * Hand spins with CSS. Safe with many cards / Chrome main thread.
 */

import { useEffect, useRef } from "react";

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
  /** card = result tiles; banner = Create waiting strip; compact = header chip */
  size?: "large" | "banner" | "card" | "compact";
  className?: string;
};

export function GenerateClock({
  startedAt,
  size = "card",
  className = "",
}: GenerateClockProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const safeStart =
    Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now();

  useEffect(() => {
    let cancelled = false;
    let lastShown = "";

    const paint = () => {
      if (cancelled || !labelRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const next = formatFastTimer(fastDisplaySeconds(safeStart));
      if (next !== lastShown) {
        lastShown = next;
        labelRef.current.textContent = next;
      }
    };

    paint();
    // Direct DOM writes — do NOT call setState (avoids freezing CreateStudio).
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
  }, [safeStart]);

  const initial = formatFastTimer(fastDisplaySeconds(safeStart));

  if (size === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-1.5 py-0.5 ${className}`}
        aria-live="off"
      >
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#22f0ff]/80 bg-black/40">
          <span
            className="vyronix-clock-hand absolute left-1/2 top-1/2 h-[6px] w-[1.5px] rounded-full bg-[#22f0ff]"
            style={{ transformOrigin: "50% 100%" }}
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

  // Fit inside result tiles / Assets running slides without dominating the frame.
  const face = size === "banner" ? 64 : size === "large" ? 72 : 52;
  const hand = Math.round(face * 0.29);
  const digitClass =
    size === "banner"
      ? "text-[11px] px-1.5 py-0.5"
      : size === "large"
        ? "text-xs px-1.5 py-0.5"
        : "text-[10px] px-1 py-0.5";
  const labelClass =
    size === "card" ? "text-[9px] text-white/55" : "text-[10px] text-white/70";

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: face, height: face }}>
        <svg
          width={face}
          height={face}
          viewBox="0 0 96 96"
          className="drop-shadow-[0_0_8px_rgba(34,240,255,0.28)]"
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
          className="vyronix-clock-hand pointer-events-none absolute left-1/2 top-1/2 block w-[2px] rounded-full bg-[#22f0ff]"
          style={{
            height: hand,
            marginTop: -hand,
            transformOrigin: "50% 100%",
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-5">
          <span
            ref={labelRef}
            className={`rounded-md bg-black/70 font-mono font-black tabular-nums tracking-tight text-[#22f0ff] ring-1 ring-[#22f0ff]/35 ${digitClass}`}
          >
            {initial}
          </span>
        </div>
      </div>
      {size !== "card" ? (
        <p className={`font-semibold ${labelClass}`}>عداد التوليد</p>
      ) : null}
    </div>
  );
}
