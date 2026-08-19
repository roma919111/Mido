"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  FolderOpen,
  LogOut,
  Settings,
} from "lucide-react";
import type { CustomerUser } from "@/components/veronix/AppHeader";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { resolveAvatarSrc, userInitials } from "@/lib/avatar-url";

export function UserAvatar({
  user,
  size = "md",
}: {
  user: Pick<CustomerUser, "name" | "avatarUrl">;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveAvatarSrc(user.avatarUrl);
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-white/15`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] font-bold text-[#0b0d12] ring-1 ring-white/15`}
    >
      {userInitials(user.name)}
    </span>
  );
}

export function ProfileMenu({
  user,
  onLogout,
}: {
  user: CustomerUser;
  onLogout?: () => void;
}) {
  const { t, dir } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const menuItemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/8 hover:text-white";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.header.account}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-white/80 transition hover:border-white/20"
      >
        <UserAvatar user={user} size="sm" />
      </button>

      {open ? (
        <div
          className="absolute end-0 top-[calc(100%+0.4rem)] z-[150] w-[min(92vw,16.5rem)] overflow-hidden rounded-2xl border border-white/12 bg-[#12161f] shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          dir={dir}
          role="menu"
        >
          <div className="border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-white/45">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClass}
            >
              <Settings className="h-4 w-4 shrink-0 text-[#22f0ff]" aria-hidden />
              {t.settings.profileTab}
            </Link>
            <Link
              href="/settings?tab=billing"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClass}
            >
              <CreditCard className="h-4 w-4 shrink-0 text-[#7c5cff]" aria-hidden />
              {t.settings.billingTab}
            </Link>
            <Link
              href="/assets"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClass}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
              {t.nav.assets}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
              className={`${menuItemClass} text-rose-200/90 hover:bg-rose-500/10 hover:text-rose-100`}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              {t.header.logout}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
