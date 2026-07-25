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
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0b0d12]/95">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <BrandLogo size="md" />
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90">
            <Coins className="h-4 w-4 text-[#22f0ff]" />
            <span className="font-semibold tabular-nums">{user ? user.credits : 0}</span>
          </div>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Zap className="h-4 w-4" />
            Upgrade
          </Link>

          {user ? (
            <div className="flex items-center gap-1">
              <Link
                href="/assets"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80"
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
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-full border border-white/15 px-3 text-sm text-white/80"
              >
                دخول
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center rounded-full bg-white px-3 text-sm font-semibold text-black"
              >
                إنشاء حساب
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
