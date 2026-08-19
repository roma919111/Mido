"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/veronix/LanguageSwitcher";
import { SiteFooter } from "@/components/veronix/SiteFooter";
import { useLocale } from "@/components/veronix/LocaleProvider";
import type { SeoLandingContent } from "@/lib/seo-landings";
import { ArrowUpRight } from "lucide-react";

export function SeoLandingPage({
  landing,
  related,
}: {
  landing: SeoLandingContent;
  related: SeoLandingContent[];
}) {
  const { t, dir } = useLocale();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <header className="border-b border-white/8 bg-[rgba(11,13,18,0.9)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Vyronix AI Studio home">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link href="/" className="text-sm text-white/55 hover:text-white" dir={dir}>
              {t.footer.backHome}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6" dir={dir}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#22f0ff]/80">
          {landing.eyebrow}
        </p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {landing.h1}
        </h1>

        <div className="mt-6 space-y-4 text-sm leading-7 text-white/70">
          {landing.intro.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={landing.ctaPrimary.href}
            className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22f0ff,#7c5cff)] px-5 py-3 text-sm font-bold text-[#0b0d12]"
          >
            {landing.ctaPrimary.label}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href={landing.ctaSecondary.href}
            className="inline-flex items-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 hover:border-white/30"
          >
            {landing.ctaSecondary.label}
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="text-base font-semibold text-white">
            {dir === "rtl" ? "المميزات" : "Features"}
          </h2>
          <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-white/70">
            {landing.features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-base font-semibold text-white">
            {dir === "rtl" ? "كيف يعمل" : "How it works"}
          </h2>
          <ol className="mt-4 space-y-4">
            {landing.steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4"
              >
                <p className="text-xs font-bold text-[#22f0ff]">
                  {dir === "rtl" ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
                </p>
                <p className="mt-1 font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm text-white/60">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-base font-semibold text-white">
            {dir === "rtl" ? "أسئلة شائعة" : "FAQ"}
          </h2>
          <div className="mt-4 space-y-4">
            {landing.faq.map((item) => (
              <div key={item.q} className="space-y-1">
                <h3 className="text-sm font-semibold text-white">{item.q}</h3>
                <p className="text-sm text-white/65">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-white/10 pt-10">
          <h2 className="text-base font-semibold text-white">{landing.relatedTitle}</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {related.map((page) => (
              <Link
                key={page.slug}
                href={page.path}
                className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-3 text-sm text-white/80 hover:border-[#22f0ff]/30"
              >
                {page.h1}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/models" className="text-[#22f0ff]">
              {t.footer.models}
            </Link>
            <Link href="/faq" className="text-[#22f0ff]">
              {t.footer.faq}
            </Link>
            <Link href="/about" className="text-[#22f0ff]">
              {t.footer.about}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
