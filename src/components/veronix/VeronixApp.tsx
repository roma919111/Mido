"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { HomeCommunityFeed } from "./HomeCommunityFeed";
import { SiteFooter } from "./SiteFooter";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";

const CreateStudio = dynamic(
  () => import("./CreateStudio").then((m) => ({ default: m.CreateStudio })),
  {
    loading: () => (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-white/35">
        …
      </div>
    ),
  },
);

const HERO_POSTER = "/promo/poster-lcp.jpg";

function HomeHeroVideo({ ariaLabel }: { ariaLabel: string }) {
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Mobile Lighthouse LCP is the poster — never let the 1.6MB reel become LCP.
    if (window.matchMedia("(min-width: 640px)").matches) {
      setPlayVideo(true);
    }
  }, []);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_POSTER}
        alt=""
        width={960}
        height={640}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {playVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={HERO_POSTER}
          aria-label={ariaLabel}
        >
          <source src="/promo/veronix-action.mp4" type="video/mp4" />
        </video>
      ) : null}
    </>
  );
}

export function VeronixApp() {
  const { t, dir } = useLocale();
  const { user, refreshUser, logout, ready, refreshing } = useCustomerUser();

  const showFreeTrialHint =
    !user || (!user.freeVeronixUsed && (user.credits ?? 0) <= 0);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => void logout()}
      />
      <main className="w-full pb-bottom-nav">
        <section className="relative w-full overflow-hidden border-b border-white/8">
          <div className="relative mx-auto w-full max-w-6xl">
            <div className="relative aspect-[16/9] w-full sm:aspect-[21/9] sm:max-h-[420px]">
              <HomeHeroVideo ariaLabel="Vyronix AI Studio promotional action film" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,18,0.15)_0%,rgba(11,13,18,0.45)_50%,rgba(11,13,18,0.92)_100%)]" />
              <div
                className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6 sm:pb-6"
                dir={dir}
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#22f0ff]/90 sm:text-xs">
                  {t.home.brandEyebrow}
                </p>
                <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {t.home.brandTitle}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                  {t.home.heroLine}
                </p>
                {showFreeTrialHint ? (
                  <p className="mt-2 text-xs font-medium text-emerald-200/90 sm:text-sm">
                    {t.home.freeTrial}
                  </p>
                ) : null}
                <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
                  <a
                    href="#create"
                    className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2 text-sm font-bold text-white"
                  >
                    {t.home.ctaCreate}
                  </a>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur"
                  >
                    {t.home.ctaPricing}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HomeCommunityFeed />

        <section id="create" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6" dir={dir}>
            <p className="text-xs uppercase tracking-[0.22em] text-[#22f0ff]/80">
              {t.home.studioEyebrow}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t.home.studioTitle}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              {t.home.studioSub}
            </p>
          </div>
          <CreateStudio user={user} onUserRefresh={refreshUser} />
        </section>
      </main>
      <div className="pb-bottom-nav">
        <SiteFooter />
      </div>
      <BottomNav />
    </div>
  );
}
