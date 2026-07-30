import type { Metadata } from "next";
import { ContactContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.contact.title,
    description: t.contact.p1,
    path: "/contact",
  });
}

export default async function ContactPage() {
  const { t } = await getRequestDictionary();
  const crumbs = breadcrumbJsonLd([
    { name: "Veronix.ai", path: "/" },
    { name: t.contact.title, path: "/contact" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <ContactContent />
    </>
  );
}
