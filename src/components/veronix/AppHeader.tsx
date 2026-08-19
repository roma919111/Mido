"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import {
  Clapperboard,
  Coins,
  Lightbulb,
  Menu,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AnimatedCredits } from "@/components/veronix/AnimatedCredits";
import { LanguageSwitcher } from "@/components/veronix/LanguageSwitcher";
import { ProfileMenu } from "@/components/veronix/ProfileMenu";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { isAdminEmail } from "@/lib/admin-shared";
import { authReturnPath, loginHref, signupHref } from "@/lib/auth-next";

export interface CustomerUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  credits: number;
  planId: string | null;
  freeVeronixUsed?: boolean;
  referralCode?: string | null;
  referredByUserId?: string | null;
}

export interface AppHeaderProps {
  user: CustomerUser | null;
  onLogout?: () => void;
  /** When false, hide guest login buttons until /me resolves (avoids flash). */
  ready?: boolean;
  /** While true, credit badge pulses until live balance lands. */
  refreshing?: boolean;
  /** Denser header for overlay / create surfaces. */
  compact?: boolean;
}

function HeaderExploreMenu({ compact }: { compact: boolean }) {
  const { t, dir } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const items = [
    {
      href: "/inspire",
      label: t.nav.inspire,
      icon: Lightbulb,
      active: pathname.startsWith("/inspire"),
    },
    {
      href: "/directors",
      label: t.nav.directors,
      icon: Clapperboard,
      active: pathname.startsWith("/directors"),
    },
  ];

  const anyActive = items.some((item) => item.active);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.header.mainNav}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center rounded-full border transition ${
          compact ? "h-8 w-8" : "h-8 w-8 sm:h-9 sm:w-9"
        } ${
          open || anyActive
            ? "border-[#22f0ff]/35 bg-[#22f0ff]/10 text-[#22f0ff]"
            : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:text-white"
        }`}
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden />
        ) : (
          <Menu className="h-4 w-4" aria-hidden />
        )}
      </button>

      {open ? (
        <div
          className="absolute start-0 top-[calc(100%+0.4rem)] z-[150] w-[min(92vw,14.5rem)] overflow-hidden rounded-2xl border border-white/12 bg-[#12161f] shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          dir={dir}
          role="menu"
        >
          <div className="border-b border-white/8 px-3 py-2.5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-white/45">
              {t.header.mainNav}
            </p>
          </div>
          <div className="p-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                    item.active
                      ? "bg-[#22f0ff]/12 font-semibold text-[#22f0ff]"
                      : "text-white/85 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GuestAuthButtons() {
  const { t } = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const next = authReturnPath(pathname, params.get("next"));
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link
        href={loginHref(next)}
        className="inline-flex h-8 items-center rounded-full border border-white/15 px-2.5 text-[11px] text-white/80 sm:h-9 sm:px-3 sm:text-sm"
      >
        {t.header.login}
      </Link>
      <Link
        href={signupHref(next)}
        className="inline-flex h-8 items-center rounded-full bg-white px-2.5 text-[11px] font-semibold text-black sm:h-9 sm:px-3 sm:text-sm"
      >
        {t.header.signup}
      </Link>
    </div>
  );
}

export function AppHeader({
  user,
  onLogout,
  ready = true,
  refreshing = false,
  compact = false,
}: AppHeaderProps) {
  const { t } = useLocale();
  const showGuestAuth = ready && !user;

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
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <HeaderExploreMenu compact={compact} />
          <Link href="/" className="min-w-0 shrink-0">
            <BrandLogo size={compact ? "sm" : "md"} />
          </Link>
        </div>

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
            <Coins
              className={`h-3 w-3 shrink-0 text-[#22f0ff] sm:h-3.5 sm:w-3.5 ${
                refreshing ? "animate-pulse" : ""
              }`}
            />
            <AnimatedCredits
              value={user ? user.credits : 0}
              syncing={refreshing || !ready}
              title={user ? String(user.credits) : "0"}
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
            <ProfileMenu user={user} onLogout={onLogout} />
          ) : showGuestAuth ? (
            <Suspense fallback={<div className="h-8 w-[7.5rem] sm:h-9" />}>
              <GuestAuthButtons />
            </Suspense>
          ) : null}
        </div>
      </div>
    </header>
  );
}
