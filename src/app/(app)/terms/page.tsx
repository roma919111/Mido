import type { Metadata } from "next";
import { TermsContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.terms.title,
    description: t.terms.body[0],
    path: "/terms",
  });
}

export default async function TermsPage() {
  const { t } = await getRequestDictionary();
  const crumbs = breadcrumbJsonLd([
    { name: "Veronix.ai", path: "/" },
    { name: t.terms.title, path: "/terms" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <TermsContent />
    </>
  );
}
