import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/veronix/PricingPage";
import { getRequestDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.pricing.title,
    description: t.pricing.subtitle,
    path: "/pricing",
  });
}

export default async function Page() {
  const { t } = await getRequestDictionary();
  const crumbs = breadcrumbJsonLd([
    { name: "Veronix.ai", path: "/" },
    { name: t.pricing.title, path: "/pricing" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0b0d12] p-8 text-white/50">
            Loading…
          </div>
        }
      >
        <PricingPage />
      </Suspense>
    </>
  );
}
