import type { Metadata } from "next";
import { DirectorsPage } from "@/components/veronix/DirectorsPage";
import { getRequestDictionary } from "@/lib/i18n";
import { SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getRequestDictionary();
  const description =
    locale === "ar"
      ? `${t.directors.subtitle} · vyronix.app/directors`
      : `${t.directors.subtitle} · vyronix.app/directors`;
  return {
    title: { absolute: t.directors.title },
    description,
    keywords: [...SEO_KEYWORDS, "ai video director style", "vyronix directors"],
    alternates: { canonical: "https://vyronix.app/directors" },
  };
}

export default function DirectorsRoutePage() {
  return <DirectorsPage />;
}
