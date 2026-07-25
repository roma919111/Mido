import { Suspense } from "react";
import { PricingPage } from "@/components/veronix/PricingPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d12] p-8 text-white/50">Loading…</div>}>
      <PricingPage />
    </Suspense>
  );
}
