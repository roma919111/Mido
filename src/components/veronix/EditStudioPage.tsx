"use client";

import { Cairo } from "next/font/google";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { EditStudio } from "@/components/veronix/EditStudio";
import { StudioMediaTabs } from "@/components/veronix/StudioMediaTabs";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700"],
  display: "swap",
});

export function EditStudioPage() {
  const { t, dir } = useLocale();
  const { user, logout, ready, refreshing } = useCustomerUser();

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
        <div className={cairo.className}>
          <EditStudio />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
