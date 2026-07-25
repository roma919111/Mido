"use client";

import Link from "next/link";
import { Coins, UserRound, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export interface CustomerUser {
  id: string;
  email: string;
  name: string;
  credits: number;
  planId: string | null;
  freeVeronixUsed?: boolean;
}

interface AppHeaderProps {
  user: CustomerUser | null;
  onLogout?: () => void;
}

export function AppHeader({ user, onLogout }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0b0d12]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <Link href="/" className="min-w-0 shrink-0">
          <BrandLogo size="md" />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/90 sm:gap-1.5 sm:px-3 sm:text-sm">
            <Coins className="h-3.5 w-3.5 text-[#22f0ff] sm:h-4 sm:w-4" />
            <span className="font-semibold tabular-nums">{user ? user.credits : 0}</span>
          </div>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-2.5 py-1.5 text-xs font-semibold text-white sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Upgrade</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-1">
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
                className="hidden text-xs text-white/45 hover:text-white sm:inline"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-full border border-white/15 px-2.5 text-xs text-white/80 sm:h-9 sm:px-3 sm:text-sm"
              >
                دخول
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-8 items-center rounded-full bg-white px-2.5 text-xs font-semibold text-black sm:h-9 sm:px-3 sm:text-sm"
              >
                حساب
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
