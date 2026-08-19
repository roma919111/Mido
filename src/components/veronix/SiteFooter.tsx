"use client";

import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { ModelLogoGrid } from "@/components/veronix/ModelLogoGrid";
import { SocialLinks } from "@/components/veronix/SocialLinks";

export function SiteFooter() {
  const { t, dir } = useLocale();
  const links = [
    { href: "/about", label: t.footer.about },
    { href: "/faq", label: t.footer.faq },
    { href: "/contact", label: t.footer.contact },
    { href: "/privacy", label: t.footer.privacy },
    { href: "/terms", label: t.footer.terms },
    { href: "/models", label: t.footer.models },
    { href: "/ai-video-generator", label: t.seoLandings.aiVideo },
    { href: "/ai-image-generator", label: t.seoLandings.aiImage },
    { href: "/invite", label: t.nav.invite },
    { href: "/pricing", label: t.footer.pricing },
  ];

  return (
    <footer className="relative z-10 border-t border-white/8 bg-[rgba(7,9,13,0.92)]">
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6"
        dir={dir}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <BrandLogo size="sm" />
            <p className="max-w-md text-sm leading-relaxed text-white/45">
              {t.footer.blurb}
            </p>
            <a
              href="mailto:support@vyronix.app"
              className="inline-block text-sm text-[#22f0ff]/90 hover:text-[#22f0ff]"
              dir="ltr"
            >
              support@vyronix.app
            </a>
            <SocialLinks className="mt-4" />
            <Suspense fallback={<div className="mt-4 h-16" aria-hidden />}>
              <ModelLogoGrid />
            </Suspense>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/55">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} Vyronix AI Studio · vyronix.app · {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
