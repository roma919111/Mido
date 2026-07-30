import type { Metadata } from "next";
import { FaqContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.faq.title,
    description: t.meta.faqDescription,
    path: "/faq",
  });
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
  const crumbs = breadcrumbJsonLd([
    { name: "Veronix.ai", path: "/" },
    { name: t.faq.title, path: "/faq" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <FaqContent />
    </>
  );
}
