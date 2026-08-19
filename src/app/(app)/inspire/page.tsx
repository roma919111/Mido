import type { Metadata } from "next";
import { InspirePage } from "@/components/veronix/InspirePage";
import { getRequestDictionary } from "@/lib/i18n";
import { SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getRequestDictionary();
  const description =
    locale === "ar"
      ? `${t.inspire.subtitle} — أفكار prompts لفيديو AI من أفلام ومسلسلات · vyronix.app/inspire`
      : `${t.inspire.subtitle} — AI video prompt ideas from movies and series · vyronix.app/inspire`;
  return {
    title: { absolute: t.inspire.title },
    description,
    keywords: [...SEO_KEYWORDS, "ai video prompts", "vyronix inspire"],
    alternates: { canonical: "https://vyronix.app/inspire" },
  };
}

export default function InspireRoutePage() {
  return <InspirePage />;
}
