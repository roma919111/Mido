import type { Metadata } from "next";
import { InvitePage } from "@/components/veronix/InvitePage";
import { getRequestDictionary } from "@/lib/i18n";
import { SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.invite.title,
    description: t.invite.subtitle,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/invite" },
    robots: { index: true, follow: true },
  };
}

export default function Page() {
  return <InvitePage />;
}
