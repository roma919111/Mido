"use client";

import Link from "next/link";
import { Coins, LogOut, Shield, UserRound, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/veronix/LanguageSwitcher";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { isAdminEmail } from "@/lib/admin-shared";

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
}

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function AppHeader({ user, onLogout, compact = false }: AppHeaderProps) {
  const { t } = useLocale();

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
            }`}
            title={user ? String(user.credits) : "0"}
          >
            <Coins className="h-3 w-3 shrink-0 text-[#22f0ff] sm:h-3.5 sm:w-3.5" />
            <span className="truncate">
              {formatCredits(user ? user.credits : 0)}
            </span>
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

          {user && isAdminEmail(user.email) ? (
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

          {user ? (
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/assets"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 sm:h-9 sm:w-9"
                title={user.email}
              >
                <UserRound className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 hover:border-rose-400/40 hover:text-rose-100 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
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
