import type { Metadata } from "next";
import { PrivacyContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.privacy.title,
    description: t.privacy.body[0],
    alternates: { canonical: "https://vyronix.app/privacy" },
  };
}

export default function PrivacyPage() {
  return <PrivacyContent />;
}
