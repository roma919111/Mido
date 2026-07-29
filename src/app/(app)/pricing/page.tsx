import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/veronix/PricingPage";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.pricing.title,
    description: t.pricing.subtitle,
    alternates: { canonical: "https://vyronix.app/pricing" },
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
