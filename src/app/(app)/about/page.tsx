import type { Metadata } from "next";
import { AboutContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.about.title,
    description: t.about.p1,
    alternates: { canonical: "https://vyronix.app/about" },
  };
}

export default function AboutPage() {
  return <AboutContent />;
}
