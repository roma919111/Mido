import type { Metadata } from "next";
import { Suspense } from "react";
import AiRentalStudioClient from "@/components/veronix/AiRentalStudioClient";
import {
  AI_RENTAL_STUDIO_NAME,
  AI_RENTAL_STUDIO_NAME_AR,
} from "@/lib/ai-rental-studio";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const ar = locale === "ar";
  const title = `${AI_RENTAL_STUDIO_NAME} · ${AI_RENTAL_STUDIO_NAME_AR} · Vyronix`;
  return {
    title,
    description: ar
      ? "استأجر ساعة — فيديوهات AI غير محدودة على GPU مخصص."
      : "Rent one hour — unlimited AI videos on a dedicated GPU.",
    robots: { index: false, follow: false },
    alternates: { canonical: "https://vyronix.app/ai-rental-studio" },
  };
}

export default async function H3VastLabPage() {
  return (
    <Suspense fallback={null}>
      <AiRentalStudioClient />
    </Suspense>
  );
}
