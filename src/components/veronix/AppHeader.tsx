"use client";

import Link from "next/link";
import { Coins, Shield, UserRound, Zap } from "lucide-react";
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
  /** Denser header for overlay surfaces (Assets feed). */
  compact?: boolean;
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
        className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-1.5 px-3 sm:gap-3 sm:px-6 ${
          compact ? "py-1.5 sm:py-2" : "py-2.5 sm:py-3"
        }`}
      >
        <Link href="/" className="min-w-0 shrink-0">
          <BrandLogo size={compact ? "sm" : "md"} />
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <LanguageSwitcher compact />

          <div
            className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 font-semibold tabular-nums text-white/90 ${
              compact
                ? "px-2 py-1 text-[11px]"
                : "px-2.5 py-1.5 text-xs sm:gap-1.5 sm:px-3 sm:text-sm"
            }`}
          >
            <Coins className="h-3.5 w-3.5 text-[#22f0ff] sm:h-4 sm:w-4" />
            <span>{user ? user.credits : 0}</span>
          </div>

          <Link
            href="/pricing"
            className={`inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] font-semibold text-white ${
              compact
                ? "h-8 w-8"
                : "gap-1 px-2.5 py-1.5 text-xs sm:gap-1.5 sm:px-3 sm:text-sm"
            }`}
            title={t.header.upgrade}
          >
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {!compact ? (
              <span className="hidden sm:inline">{t.header.upgrade}</span>
            ) : null}
          </Link>

          {user && isAdminEmail(user.email) ? (
            <Link
              href="/admin"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-100 sm:h-9 sm:w-auto sm:gap-1 sm:px-3"
              title={t.header.admin}
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.header.admin}</span>
            </Link>
          ) : null}

          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
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
                className={`inline-flex items-center rounded-full border border-white/15 text-white/80 hover:border-rose-400/40 hover:text-rose-100 ${
                  compact
                    ? "h-8 px-2 text-[11px]"
                    : "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                }`}
              >
                {t.header.logout}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-full border border-white/15 px-2.5 text-xs text-white/80 sm:h-9 sm:px-3 sm:text-sm"
              >
                {t.header.login}
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-8 items-center rounded-full bg-white px-2.5 text-xs font-semibold text-black sm:h-9 sm:px-3 sm:text-sm"
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
