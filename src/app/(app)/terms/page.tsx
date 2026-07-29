import type { Metadata } from "next";
import { TermsContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.terms.title,
    description: t.terms.body[0],
    alternates: { canonical: "https://vyronix.app/terms" },
  };
}

export default function TermsPage() {
  return <TermsContent />;
}
