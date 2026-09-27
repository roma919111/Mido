"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { DeployStamp } from "@/components/veronix/DeployStamp";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { RentalDigitalClock } from "@/components/veronix/RentalDigitalClock";
import { StudioPrepClock } from "@/components/veronix/StudioPrepClock";
import { VyronixIdBadge } from "@/components/veronix/VyronixIdBadge";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import {
  AI_RENTAL_STUDIO_NAME,
  AI_RENTAL_STUDIO_NAME_AR,
  STUDIO_RENTAL_PRICING_PATH,
} from "@/lib/ai-rental-studio";
import { loginHref } from "@/lib/auth-next";

export type H3LabClientProps = {
  returnPath?: string;
  extraSection?: ReactNode;
  topSection?: ReactNode;
  linkSection?: ReactNode;
  hideHeroCard?: boolean;
  hideFloatingResultCard?: boolean;
  gpuOnly?: boolean;
  rentalEndsAt?: string;
  rentalStartedAt?: string;
  paidHourActive?: boolean;
  rentalGpuFailover?: boolean;
  rentalFrozen?: boolean;
  rentalPodReady?: boolean;
  rentalCanGenerate?: boolean;
  rentalVyronixId?: number;
  rentalPrepStartedAt?: string;
  needsVyronixLink?: boolean;
  studioUnlocked?: boolean;
  guestStudioPreview?: boolean;
};

function parsePrepStartedMs(iso: string | undefined): number | undefined {
  if (!iso?.trim()) return undefined;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

/**
 * Rental studio frame (header, GPU status strip, rental clock, nav).
 * The H3/LTX generation panel from production module 841482 is not restored yet;
 * its prop contract is kept so H3VastLabPage stays wired for the full client.
 */
export function H3LabClient({
  returnPath = "/h3-lab",
  extraSection,
  topSection,
  linkSection,
  hideHeroCard = false,
  gpuOnly = false,
  rentalEndsAt,
  rentalStartedAt,
  paidHourActive = false,
  rentalGpuFailover = false,
  rentalFrozen = false,
  rentalPodReady = false,
  rentalCanGenerate = false,
  rentalVyronixId,
  rentalPrepStartedAt,
  needsVyronixLink = false,
  studioUnlocked = false,
  guestStudioPreview = false,
}: H3LabClientProps) {
  const { locale, dir, t } = useLocale();
  const ar = locale === "ar";
  const { user, logout, ready, refreshing } = useCustomerUser();
  const studioName = ar ? AI_RENTAL_STUDIO_NAME_AR : AI_RENTAL_STUDIO_NAME;
  const preparing = studioUnlocked && !rentalPodReady && !rentalGpuFailover;

  if (!ready && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d12]">
        <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
      </div>
    );
  }

  if (ready && !user && !(guestStudioPreview && gpuOnly)) {
    return (
      <div className="min-h-screen bg-[#0b0d12] px-4 py-12 text-center text-white">
        <p className="mb-4">{ar ? "سجّل الدخول لاستخدام المختبر" : "Sign in to use H3 Lab"}</p>
        <Link href={loginHref(returnPath)} className="text-[#22f0ff] underline">
          {ar ? "تسجيل الدخول" : "Login"}
        </Link>
      </div>
    );
  }

  const statusChip = needsVyronixLink ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-3 py-1 text-[11px] font-semibold text-[#c8fbff]">
      {ar ? "○ أدخل Vyronix ID للربط" : "○ Enter Vyronix ID to link"}
    </span>
  ) : rentalPodReady && studioUnlocked ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-100">
      {ar ? "● GPU مربوط — الاستوديو جاهز" : "● GPU linked — studio ready"}
    </span>
  ) : studioUnlocked ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
      {ar ? "● GPU متصل — جاري التحميل…" : "● GPU connected — loading…"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/55">
      {ar ? "○ GPU غير مربوط" : "○ GPU not linked"}
    </span>
  );

  return (
    <div className="relative min-h-[100dvh] bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader
        compact
        user={user}
        onLogout={() => void logout()}
        ready={ready}
        refreshing={refreshing}
      />
      <main className="overflow-x-hidden pb-bottom-nav">
        {topSection ? (
          <div className="mx-auto max-w-3xl px-4 pt-3 sm:px-6">{topSection}</div>
        ) : null}
        {hideHeroCard ? (
          gpuOnly ? (
            <section className="mx-auto max-w-3xl px-4 pt-2 sm:px-6" dir={dir}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DeployStamp className="text-[10px] font-mono text-white/40" />
                <div className="flex flex-wrap items-center gap-2">
                  {statusChip}
                  {rentalEndsAt ? (
                    <RentalDigitalClock
                      endsAt={rentalEndsAt}
                      startedAt={rentalStartedAt}
                      ar={ar}
                      compact
                      showWindow
                    />
                  ) : null}
                </div>
              </div>
            </section>
          ) : null
        ) : (
          <section className="mx-auto max-w-3xl px-4 pt-3 sm:px-6 sm:pt-6" dir={dir}>
            <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#141821] via-[#10141c] to-[#0b0d12] p-5 sm:p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#22f0ff]/85 sm:text-xs">
                {studioName}
              </p>
              <DeployStamp className="mt-3 text-[10px] font-mono text-white/40" />
              <div className="mt-3 flex flex-wrap items-center gap-2">{statusChip}</div>
            </div>
          </section>
        )}
        <section className="mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-6" dir={dir}>
          {linkSection ? <div>{linkSection}</div> : null}
          {rentalGpuFailover ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-bold">{t.studioRental.failoverTitle}</p>
              <p className="mt-1 text-amber-100/80">{t.studioRental.failoverBody}</p>
              {rentalFrozen ? (
                <p className="mt-1 text-xs text-amber-100/70">
                  {t.studioRental.failoverFrozenNote}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/8 bg-[#141821]/95 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-xl font-extrabold sm:text-2xl">{studioName}</h1>
                <p className="mt-1 text-xs text-white/50">{t.studioRental.studioPreviewHint}</p>
              </div>
              {rentalVyronixId ? (
                <VyronixIdBadge
                  vyronixId={rentalVyronixId}
                  prepStartedAt={rentalPrepStartedAt}
                  ar={ar}
                  compact
                />
              ) : null}
            </div>
            {preparing ? (
              <div className="mt-5 flex flex-col items-center gap-3 text-center">
                <StudioPrepClock
                  startedAt={parsePrepStartedMs(rentalPrepStartedAt)}
                  label={t.studioRental.prepTitle}
                />
                <p className="text-xs text-white/55">{t.studioRental.prepBillingNote}</p>
              </div>
            ) : null}
            {paidHourActive && rentalPodReady ? (
              <p className="mt-4 text-sm font-semibold text-emerald-200/90">
                {t.studioRental.studioReady}
              </p>
            ) : null}
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/60">
              {rentalCanGenerate
                ? ar
                  ? "واجهة التوليد (H3/LTX) قيد الاستعادة — ستظهر هنا قريباً."
                  : "The H3/LTX generation panel is being restored — it will appear here soon."
                : ar
                  ? "التوليد يتفعّل بعد ربط Vyronix ID وجاهزية GPU."
                  : "Generation unlocks after linking your Vyronix ID and GPU readiness."}
            </p>
            {!user ? (
              <p className="mt-3 text-center text-xs leading-relaxed text-amber-200/85">
                {ar ? "اشترك من " : "Subscribe from "}
                <Link
                  href={STUDIO_RENTAL_PRICING_PATH}
                  className="font-semibold text-[#22f0ff] underline"
                >
                  {ar ? "صفحة الباقات" : "the pricing page"}
                </Link>
                {ar ? " لتفعيل التوليد" : " to unlock generation"}
              </p>
            ) : null}
          </div>
          {extraSection ? <div className="space-y-4">{extraSection}</div> : null}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
