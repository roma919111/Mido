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
    title: t.meta.inspireTitle,
    description: t.meta.inspireDescription,
    path: "/inspire",
  });
}

export default async function InspirePage() {
  const { t, dir } = await getRequestDictionary();
  const ideas =
    dir === "rtl"
      ? [
          "زقاق نيون سينمائي ليلاً مع انعكاسات المطر",
          "لقطة منتج لعطر بإضاءة استوديو ناعمة",
          "شخصية أنمي تمشي في شارع أزهار الكرز",
        ]
      : [
          "Cinematic neon alley at night, rain reflections",
          "Product hero shot of perfume bottle, soft studio light",
          "Anime character walking through cherry blossom street",
        ];

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white" dir={dir}>
      <header className="border-b border-white/8 px-4 py-4">
        <BrandLogo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-10">
        <h1 className="font-display text-3xl font-extrabold">{t.meta.inspireTitle}</h1>
        <p className="mt-3 text-white/50">{t.meta.inspireDescription}</p>
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
      </main>
      <BottomNav />
    </div>
  );
}
