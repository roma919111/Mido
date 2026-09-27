import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { H3VastLabPage } from "@/components/veronix/H3VastLabPage";
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

export default function AiRentalStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0d12] px-6">
          <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
        </div>
      }
    >
      <H3VastLabPage />
    </Suspense>
  );
}
