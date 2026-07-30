"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins, LogOut, Shield, UserRound, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/veronix/LanguageSwitcher";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { isAdminEmail } from "@/lib/admin-shared";
import { readCachedCustomer } from "@/lib/customer-session-cache";

export interface CustomerUser {
  id: string;
  email: string;
  name: string;
  credits: number;
  planId: string | null;
  freeVeronixUsed?: boolean;
  locked?: boolean;
}

export interface AppHeaderProps {
  user: CustomerUser | null;
  onLogout?: () => void;
  /** Denser header for overlay / create surfaces. */
  compact?: boolean;
  /**
   * false while `/api/auth/customer/me` is in flight.
   * Keeps the header chrome stable (no Login flash) and animates credits.
   */
  sessionReady?: boolean;
}

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Smart credits motion for ~2s while the session hydrates. */
function CreditsMotion({
  value,
  animating,
}: {
  value: number;
  animating: boolean;
}) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!animating) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const duration = 2000;
    const from = Math.max(0, Math.round(value * 0.82));
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      const wobble =
        Math.sin(t * Math.PI * 8) * (1 - t) * Math.max(40, value * 0.018);
      setShown(Math.max(0, Math.round(from + (value - from) * eased + wobble)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setShown(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animating]);

  return (
    <span
      className={`truncate tabular-nums ${animating ? "text-[#22f0ff]" : ""}`}
    >
      {formatCredits(shown)}
    </span>
  );
}

export function AppHeader({
  user,
  onLogout,
  compact = false,
  sessionReady = true,
}: AppHeaderProps) {
  const { t } = useLocale();
  const [cached] = useState<CustomerUser | null>(() => readCachedCustomer());
  const hydrating = !sessionReady;
  const displayUser = user ?? (hydrating ? cached : null);
  const creditsValue = displayUser?.credits ?? 0;
  // Keep logged-in chrome while hydrating so Login never flashes.
  const showLoggedInChrome = Boolean(displayUser) || hydrating;
  /** Credits number motion for ~2s on each page mount (BottomNav soft nav). */
  const [creditsAnimating, setCreditsAnimating] = useState(true);
  useEffect(() => {
    setCreditsAnimating(true);
    const t = window.setTimeout(() => setCreditsAnimating(false), 2000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-white/8 bg-[#0b0d12]/95 backdrop-blur ${
        compact ? "border-white/5" : ""
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-1 px-3 sm:gap-3 sm:px-6 ${
          compact ? "py-1.5 sm:py-2" : "py-2 sm:py-3"
        }`}
      >
        <Link href="/" className="min-w-0 shrink-0">
          <span className="inline-flex sm:hidden">
            <BrandLogo size="sm" />
          </span>
          <span className="hidden sm:inline-flex">
            <BrandLogo size={compact ? "sm" : "md"} />
          </span>
        </Link>

        <div className="flex min-w-0 shrink items-center gap-1 sm:gap-2">
          <LanguageSwitcher compact />

          <div
            className={`inline-flex max-w-[5.5rem] items-center gap-0.5 overflow-hidden rounded-full border border-white/10 bg-white/5 font-semibold tabular-nums text-white/90 sm:max-w-none sm:gap-1.5 ${
              compact
                ? "px-1.5 py-1 text-[10px] sm:px-2 sm:text-[11px]"
                : "px-2 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-sm"
            } ${creditsAnimating || hydrating ? "ring-1 ring-[#22f0ff]/35" : ""}`}
            title={String(creditsValue)}
            aria-busy={hydrating || creditsAnimating}
          >
            <Coins
              className={`h-3 w-3 shrink-0 text-[#22f0ff] sm:h-3.5 sm:w-3.5 ${
                creditsAnimating || hydrating ? "animate-pulse" : ""
              }`}
            />
            <CreditsMotion
              value={creditsValue}
              animating={creditsAnimating || hydrating}
            />
          </div>

          <Link
            href="/pricing"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] text-white sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
            title={t.header.upgrade}
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline sm:text-sm sm:font-semibold">
              {t.header.upgrade}
            </span>
          </Link>

          {displayUser && isAdminEmail(displayUser.email) ? (
            <Link
              href="/admin"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-100 sm:h-9 sm:w-auto sm:gap-1 sm:px-3"
              title={t.header.admin}
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline sm:text-sm sm:font-semibold">
                {t.header.admin}
              </span>
            </Link>
          ) : null}

          {showLoggedInChrome ? (
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/assets"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 sm:h-9 sm:w-9"
                title={displayUser?.email || t.nav.assets}
              >
                <UserRound className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={onLogout}
                disabled={hydrating && !user}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 hover:border-rose-400/40 hover:text-rose-100 disabled:opacity-50 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
                title={t.header.logout}
                aria-label={t.header.logout}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline sm:text-sm">{t.header.logout}</span>
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-full border border-white/15 px-2.5 text-[11px] text-white/80 sm:h-9 sm:px-3 sm:text-sm"
              >
                {t.header.login}
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-8 items-center rounded-full bg-white px-2.5 text-[11px] font-semibold text-black sm:h-9 sm:px-3 sm:text-sm"
              >
                {t.header.signup}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
