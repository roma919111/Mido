import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/veronix/PricingPage";

export const metadata: Metadata = {
  title: "الباقات والأسعار",
  description:
    "باقات Veronix.ai الشهرية وشحن الكريدت: الأساسية، برو 7200، الترا 14400. دفع آمن عبر Stripe.",
  alternates: { canonical: "https://vyronix.app/pricing" },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d12] p-8 text-white/50">Loading…</div>}>
      <PricingPage />
    </Suspense>
  );
}
