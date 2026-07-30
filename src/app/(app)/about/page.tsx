import type { Metadata } from "next";
import { AboutContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.about.title,
    description: t.about.p1,
    path: "/about",
  });
}

export default async function AboutPage() {
  const { t } = await getRequestDictionary();
  const crumbs = breadcrumbJsonLd([
    { name: "Veronix.ai", path: "/" },
    { name: t.about.title, path: "/about" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <AboutContent />
    </>
  );
}
