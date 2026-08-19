"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/veronix/LanguageSwitcher";
import { SiteFooter } from "./SiteFooter";
import { useLocale } from "@/components/veronix/LocaleProvider";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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
            <Link
              href="/"
              className="text-sm text-white/55 hover:text-white"
              dir={dir}
            >
              {t.footer.backHome}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6" dir={dir}>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        <div className="prose-legal mt-6 space-y-4 text-sm leading-7 text-white/70">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
