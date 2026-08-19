"use client";

import Link from "next/link";
import { Cairo } from "next/font/google";
import { Crown, Scissors } from "lucide-react";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { EditStudio } from "@/components/veronix/EditStudio";
import { StudioMediaTabs } from "@/components/veronix/StudioMediaTabs";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { canUseEditStudio } from "@/lib/plans";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700"],
  display: "swap",
});

function EditStudioUltraGate({
  loggedIn,
}: {
  loggedIn: boolean;
}) {
  const { t, dir } = useLocale();

  return (
    <section
      className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14"
      dir={dir}
    >
      <div className="overflow-hidden rounded-3xl border border-[#7c5cff]/35 bg-[linear-gradient(165deg,rgba(124,92,255,0.16),rgba(13,17,24,0.98))] p-6 shadow-2xl ring-1 ring-white/10 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7c5cff]/20 text-[#d4c4ff] ring-1 ring-[#7c5cff]/35">
          <Scissors className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-center text-xl font-extrabold text-white">
          {t.editStudio.ultraRequiredTitle}
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-white/65">
          {loggedIn ? t.editStudio.ultraRequiredBody : t.editStudio.ultraRequiredLogin}
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          {!loggedIn ? (
            <Link
              href="/login?next=%2Fedit"
              className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-bold text-white ring-1 ring-white/15"
            >
              {t.auth.submitLogin}
            </Link>
          ) : null}
          <Link
            href="/pricing?feature=edit"
            className="flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-3 text-sm font-extrabold text-[#0b0d12]"
          >
            <Crown className="h-4 w-4" />
            {t.editStudio.upgradeToUltra}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function EditStudioPage() {
  const { t, dir } = useLocale();
  const { user, logout, ready, refreshing } = useCustomerUser();
  const editAllowed = canUseEditStudio(user?.planId);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader
        compact
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => void logout()}
      />
      <main className="pb-bottom-nav">
        <section className="mx-auto max-w-3xl px-4 pt-3 sm:px-6 sm:pt-6" dir={dir}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#22f0ff]/80 sm:text-xs sm:tracking-[0.22em]">
            {t.home.studioEyebrow}
          </p>
          <h1 className="mt-1 font-display text-xl font-extrabold leading-tight tracking-tight sm:mt-2 sm:text-3xl">
            {t.editStudio.title}
          </h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-white/55 sm:mt-2 sm:text-sm">
            {t.editStudio.subtitle}
          </p>
          <div className="mt-4">
            <StudioMediaTabs />
          </div>
        </section>
        {!ready ? (
          <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-white/40">
            …
          </div>
        ) : editAllowed ? (
          <div className={cairo.className}>
            <EditStudio />
          </div>
        ) : (
          <EditStudioUltraGate loggedIn={Boolean(user)} />
        )}
      </main>
      <BottomNav />
    </div>
  );
}
