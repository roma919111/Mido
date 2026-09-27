"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DeployStamp } from "@/components/veronix/DeployStamp";
import {
  AI_RENTAL_STUDIO_NAME,
  AI_RENTAL_STUDIO_NAME_AR,
  STUDIO_RENTAL_DURATION_HOURS,
  STUDIO_RENTAL_PRICE_USD,
  STUDIO_RENTAL_PRICING_PATH,
} from "@/lib/ai-rental-studio";

type Props = { ar?: boolean };

/**
 * Interim shell while H3LabClient + /api/h3-lab/* are restored from production.
 * Keeps /ai-rental-studio routable in git without a 404 on future deploys.
 */
export function H3RentalStudioShell({ ar = true }: Props) {
  const dir = ar ? "rtl" : "ltr";
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6" dir={dir}>
      <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#141821] via-[#10141c] to-[#0b0d12] p-5 sm:p-7">
        <BrandLogo size="lg" className="mb-4" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#22f0ff]/85 sm:text-xs">
          {ar ? AI_RENTAL_STUDIO_NAME_AR : AI_RENTAL_STUDIO_NAME}
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          {ar ? AI_RENTAL_STUDIO_NAME_AR : AI_RENTAL_STUDIO_NAME}
        </h1>
        <DeployStamp className="mt-3 text-[10px] font-mono text-white/40" />
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          {ar
            ? `استوديو التأجير (${STUDIO_RENTAL_DURATION_HOURS} ساعات · $${STUDIO_RENTAL_PRICE_USD}) — جاري استعادة واجهة H3/LTX من نسخة الإنتاج إلى GitHub. لا تنشر main على Railway حتى اكتمال H3LabClient ومسارات /api/h3-lab.`
            : `GPU rental studio (${STUDIO_RENTAL_DURATION_HOURS}h · $${STUDIO_RENTAL_PRICE_USD}) — restoring the H3/LTX client and /api/h3-lab routes from production into GitHub. Do not deploy main to Railway until H3LabClient recovery is complete.`}
        </p>
        <Link
          href={STUDIO_RENTAL_PRICING_PATH}
          className="mt-6 inline-flex rounded-full bg-[#22f0ff] px-5 py-2.5 text-sm font-bold text-black"
        >
          {ar ? "الباقات والدفع" : "Pricing & checkout"}
        </Link>
      </div>
    </section>
  );
}
