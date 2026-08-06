import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BottomNav } from "@/components/veronix/BottomNav";
import { getRequestDictionary } from "@/lib/i18n";
import { SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.nav.inspire,
    description:
      localeAwareInspireDescription(t.nav.inspire) +
      " — Veronix.ai AI video and image prompt ideas.",
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/inspire" },
  };
}

function localeAwareInspireDescription(label: string) {
  return `${label} — AI creative prompts on Veronix.ai`;
}

export default async function InspirePage() {
  const { t, dir } = await getRequestDictionary();
  const ideas =
    dir === "rtl"
      ? [
          "زقاق سينمائي بالنيون ليلاً مع انعكاسات المطر",
          "لقطة منتج فاخر لزجاجة عطر بإضاءة استوديو ناعمة",
          "شخصية أنمي تمشي في شارع أزهار الكرز",
        ]
      : [
          "Cinematic neon alley at night, rain reflections",
          "Product hero shot of perfume bottle, soft studio light",
          "Anime character walking through cherry blossom street",
        ];

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <header className="border-b border-white/8 px-4 py-4">
        <BrandLogo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-bottom-nav pt-10" dir={dir}>
        <h1 className="font-display text-3xl font-extrabold">{t.nav.inspire}</h1>
        <p className="mt-3 text-white/50">
          {dir === "rtl"
            ? "تصفّح أفكارًا جاهزة وابدأ الإنشاء بوصف أولي."
            : "Browse ideas and jump into Create with a starting prompt."}
        </p>
        <div className="mt-6 grid gap-3">
          {ideas.map((idea) => (
            <Link
              key={idea}
              href={`/?idea=${encodeURIComponent(idea)}`}
              className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-4 text-sm text-white/80"
            >
              {idea}
            </Link>
          ))}
        </div>
        <Link href="/models" className="mt-8 inline-block text-sm text-[#22f0ff]">
          {dir === "rtl" ? "عرض كل الموديلات →" : "Browse all AI models →"}
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
