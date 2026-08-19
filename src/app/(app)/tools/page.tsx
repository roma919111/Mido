import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BottomNav } from "@/components/veronix/BottomNav";
import { getRequestDictionary } from "@/lib/i18n";
import { pageOpenGraph, SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.nav.tools,
    description: t.seoPages.toolsDescription,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/tools" },
    openGraph: pageOpenGraph("/tools", t.nav.tools, t.seoPages.toolsDescription),
  };
}

export default async function ToolsPage() {
  const { t, dir } = await getRequestDictionary();

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <header className="border-b border-white/8 px-4 py-4">
        <BrandLogo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-bottom-nav pt-10" dir={dir}>
        <h1 className="font-display text-3xl font-extrabold">{t.nav.tools}</h1>
        <p className="mt-3 text-white/50">
          {dir === "rtl"
            ? "اختصارات سريعة لمنشئي Vyronix AI Studio."
            : "Quick actions for Vyronix AI Studio creators."}
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/create/video" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {dir === "rtl" ? "إنشاء فيديو بالذكاء الاصطناعي" : "Create AI video"}
          </Link>
          <Link href="/create/image" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {dir === "rtl" ? "إنشاء صورة بالذكاء الاصطناعي" : "Create AI image"}
          </Link>
          <Link href="/edit" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {dir === "rtl" ? "استوديو التحرير" : "Edit studio"}
          </Link>
          <Link href="/inspire" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {t.nav.inspire}
          </Link>
          <Link href="/invite" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {dir === "rtl" ? "ادعُ أصدقاء واكسب كريدت" : "Invite friends & earn credits"}
          </Link>
          <Link href="/models" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {dir === "rtl" ? "كل موديلات AI" : "All AI models"}
          </Link>
          <Link href="/pricing" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {t.footer.pricing}
          </Link>
          <Link href="/assets" className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4">
            {t.nav.assets}
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
