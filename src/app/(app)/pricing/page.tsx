import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/veronix/PricingPage";

export const metadata: Metadata = {
  title: "الباقات والأسعار",
  description:
    "باقات Veronix.ai: برو 150,000 كريدت، الترا 260,000 كريدت، وشحن $4 / $8 / $14. وضوح 480p و720p. دفع آمن عبر Stripe.",
  alternates: { canonical: "https://vyronix.app/pricing" },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d12] p-8 text-white/50">Loading…</div>}>
      <PricingPage />
    </Suspense>
  );
}
