import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/veronix/PricingPage";
import { getRequestDictionary } from "@/lib/i18n";
import { pageOpenGraph, SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.pricing.title,
    description: t.seoPages.pricingDescription,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/pricing" },
    openGraph: pageOpenGraph("/pricing", t.pricing.title, t.seoPages.pricingDescription),
  };
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0d12] p-8 text-white/50">
          Loading…
        </div>
      }
    >
      <PricingPage />
    </Suspense>
  );
}
