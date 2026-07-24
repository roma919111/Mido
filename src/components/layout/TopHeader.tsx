"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Search, UserRound, Zap } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";

export function TopHeader() {
  const { user, openPricing, setUser, refreshUser } = useApp();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
    await refreshUser();
    router.push("/login");
  }

  return (
    <header className="glass sticky top-0 z-30 border-b border-[var(--border)] px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, styles, prompts, creators…"
            className="w-full rounded-full border border-white/10 bg-black/30 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-400/40 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 sm:flex">
            <Zap className="h-4 w-4 text-cyan-300" />
            <span className="font-semibold tabular-nums">{user?.credits ?? 0} Credits</span>
          </div>

          <button
            type="button"
            onClick={openPricing}
            className="animate-pulse-glow rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-300 px-3 py-2 text-sm font-semibold text-[#041018] sm:px-4"
          >
            Upgrade to Pro
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300/80 to-sky-600 text-xs font-bold text-[#041018]">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm text-white/80 md:block">
                  {user.fullName}
                </span>
                <ChevronDown className="h-4 w-4 text-white/40" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#101622] shadow-2xl">
                  <div className="border-b border-white/8 px-4 py-3">
                    <p className="truncate text-sm text-white">{user.fullName}</p>
                    <p className="truncate text-xs text-white/40">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.04]"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile & Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-200 hover:bg-white/[0.04]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/[0.04]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
