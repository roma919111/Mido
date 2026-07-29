import type { Metadata } from "next";
import { FaqContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.faq.title,
    description: t.meta.description,
    alternates: { canonical: "https://vyronix.app/faq" },
  };
}

export default async function FaqPage() {
  const { t } = await getRequestDictionary();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FaqContent />
    </>
  );
}
