import type { Metadata } from "next";
import { ModelsPage } from "@/components/veronix/ModelsPage";
import { getRequestDictionary } from "@/lib/i18n";
import { breadcrumbJsonLd, modelsItemListJsonLd, SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.models.title,
    description: t.models.subtitle,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/models" },
    openGraph: {
      title: t.models.title,
      description: t.models.subtitle,
      url: "https://vyronix.app/models",
    },
  };
}

export default async function Page() {
  const { t } = await getRequestDictionary();
  const jsonLd = [
    modelsItemListJsonLd(),
    breadcrumbJsonLd([
      { name: "Veronix.ai", path: "/" },
      { name: t.models.title, path: "/models" },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="sr-only" aria-hidden={false}>
        <h1>{t.models.title}</h1>
        <p>{t.models.subtitle}</p>
      </section>
      <ModelsPage />
    </>
  );
}
