import type { Metadata } from "next";
import { AboutContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";
import { pageOpenGraph } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.about.title,
    description: t.about.p1,
    alternates: { canonical: "https://vyronix.app/about" },
    openGraph: pageOpenGraph("/about", t.about.title, t.about.p1),
  };
}

export default function AboutPage() {
  return <AboutContent />;
}
