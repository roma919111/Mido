import type { Metadata } from "next";
import { EditStudioPage } from "@/components/veronix/EditStudioPage";
import { getRequestDictionary } from "@/lib/i18n";
import { pageOpenGraph, SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: { absolute: t.seoPages.editTitle },
    description: t.seoPages.editDescription,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/edit" },
    openGraph: pageOpenGraph("/edit", t.seoPages.editTitle, t.seoPages.editDescription),
  };
}

export default function Page() {
  return <EditStudioPage />;
}
