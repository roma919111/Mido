import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BottomNav } from "@/components/veronix/BottomNav";
import { getRequestDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.meta.toolsTitle,
    description: t.meta.toolsDescription,
    path: "/tools",
  });
}

export default async function ToolsPage() {
  const { t, dir } = await getRequestDictionary();

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white" dir={dir}>
      <header className="border-b border-white/8 px-4 py-4">
        <BrandLogo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-10">
        <h1 className="font-display text-3xl font-extrabold">{t.meta.toolsTitle}</h1>
        <p className="mt-3 text-white/50">{t.meta.toolsDescription}</p>
        <div className="mt-6 grid gap-3">
          <Link href="/" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {t.nav.create}
          </Link>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4"
          >
            {t.footer.pricing}
          </Link>
          <Link
            href="/assets"
            className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4"
          >
            {t.nav.assets}
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
