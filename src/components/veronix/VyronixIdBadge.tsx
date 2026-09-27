"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  vyronixId?: number | null;
  prepStartedAt?: string | null;
  ar?: boolean;
  compact?: boolean;
  className?: string;
};

function formatPrepStarted(iso: string | null | undefined, ar: boolean): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString(ar ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VyronixIdBadge({
  vyronixId,
  prepStartedAt,
  ar = false,
  compact = false,
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);
  const label = vyronixId != null && vyronixId > 0 ? String(vyronixId) : "—";
  const prepLabel = formatPrepStarted(prepStartedAt, ar);

  const onCopy = useCallback(async () => {
    if (!vyronixId || vyronixId <= 0) return;
    try {
      await navigator.clipboard.writeText(String(vyronixId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [vyronixId]);

  return (
    <div
      className={`rounded-2xl border border-white/12 bg-[#0f1218]/90 px-3 py-2.5 text-center ${
        compact ? "min-w-[7.5rem]" : "min-w-[9rem]"
      } ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#22f0ff]/85">
        {ar ? "فيرونيكس ID" : "Vyronix ID"}
      </p>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <span className="font-mono text-base font-bold tabular-nums text-white sm:text-lg">
          {label}
        </span>
        {vyronixId != null && vyronixId > 0 ? (
          <button
            type="button"
            onClick={() => void onCopy()}
            className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label={ar ? "نسخ" : "Copy"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>
      {prepLabel ? (
        <p className="mt-1.5 text-[9px] leading-snug text-white/45">
          {ar ? "بدء التأجير (تجهيز):" : "Rental prep started:"}
          <br />
          <span dir="ltr" className="text-white/60">
            {prepLabel}
          </span>
        </p>
      ) : (
        <p className="mt-1.5 text-[9px] text-white/40">
          {ar ? "يُربط بـ GPU" : "Linked to GPU"}
        </p>
      )}
    </div>
  );
}
