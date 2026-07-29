import type { Metadata } from "next";
import { ContactContent } from "@/components/veronix/MarketingPages";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.contact.title,
    description: t.contact.p1,
    alternates: { canonical: "https://vyronix.app/contact" },
  };
}

export default function ContactPage() {
  return <ContactContent />;
}
