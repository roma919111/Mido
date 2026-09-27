"use client";

import { useEffect, useMemo, useState } from "react";

function formatWindow(iso: string | undefined, ar: boolean): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(ar ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type Props = {
  endsAt: string;
  startedAt?: string;
  ar?: boolean;
  label?: string;
  compact?: boolean;
  showWindow?: boolean;
  paused?: boolean;
  frozenRemainingMs?: number;
};

export function RentalDigitalClock({
  endsAt,
  startedAt,
  ar = false,
  label,
  compact = false,
  showWindow = false,
  paused = false,
  frozenRemainingMs,
}: Props) {
  const endsMs = useMemo(() => {
    if (!endsAt?.trim()) return 0;
    const t = new Date(endsAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }, [endsAt]);

  const [, bump] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => bump((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);

  const remainingMs =
    paused && frozenRemainingMs != null && frozenRemainingMs > 0
      ? frozenRemainingMs
      : endsMs > 0
        ? Math.max(0, endsMs - Date.now())
        : 0;

  if (!endsMs && !(paused && frozenRemainingMs != null && frozenRemainingMs > 0)) {
    return null;
  }

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const display = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const expired = remainingMs <= 0;

  if (compact) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <span
          className={`font-mono text-sm font-bold tabular-nums tracking-wider ${expired ? "text-red-300" : "text-[#22f0ff]"}`}
          aria-live="polite"
        >
          {display}
        </span>
        {showWindow && (startedAt || endsAt) ? (
          <span className="text-[10px] tabular-nums text-white/45">
            {formatWindow(startedAt || endsAt, ar)}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {label ? (
        <p className="text-center text-xs font-semibold text-white/70">{label}</p>
      ) : null}
      <div
        className={`rounded-2xl border px-6 py-4 font-mono text-4xl font-black tabular-nums tracking-[0.2em] shadow-inner sm:text-5xl ${
          expired
            ? "border-red-400/40 bg-red-500/10 text-red-200"
            : "border-emerald-400/40 bg-black/40 text-white ring-1 ring-emerald-400/20"
        }`}
        aria-live="polite"
      >
        {display}
      </div>
      {showWindow && (startedAt || endsAt) ? (
        <p className="text-center text-[11px] tabular-nums text-white/55">
          {ar ? "نافذة التأجير:" : "Rental window:"}
          <br />
          <span dir="ltr" className="text-white/60">
            {formatWindow(startedAt, ar)} — {formatWindow(endsAt, ar)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
