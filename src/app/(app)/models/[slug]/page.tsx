import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModelDetailPage } from "@/components/veronix/ModelDetailPage";
import { getRequestDictionary } from "@/lib/i18n";
import {
  allModelSlugs,
  findModelBySlug,
  modelPageUrl,
  modelSeoDescription,
  modelSeoTitle,
  modelSearchKeywords,
  modelSoftwareJsonLd,
} from "@/lib/model-seo";
import { breadcrumbJsonLd, SEO_KEYWORDS } from "@/lib/seo";
import { BRAND_NAME } from "@/lib/brand";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return allModelSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const model = findModelBySlug(slug);
  const { locale } = await getRequestDictionary();
  if (!model) return { title: "Model not found" };
  return {
    title: { absolute: modelSeoTitle(model, locale) },
    description: modelSeoDescription(model, locale),
    keywords: [...SEO_KEYWORDS, ...modelSearchKeywords(model)],
    alternates: { canonical: modelPageUrl(model) },
    openGraph: {
      title: modelSeoTitle(model, locale),
      description: modelSeoDescription(model, locale),
      url: modelPageUrl(model),
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const model = findModelBySlug(slug);
  if (!model) notFound();

  const { t, locale } = await getRequestDictionary();
  const jsonLd = [
    modelSoftwareJsonLd(model),
    breadcrumbJsonLd([
      { name: BRAND_NAME, path: "/" },
      { name: t.footer.models, path: "/models" },
      { name: model.name, path: `/models/${slug}` },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="sr-only" aria-hidden={false}>
        <h1>{modelSeoTitle(model, locale)}</h1>
        <p>{modelSeoDescription(model, locale)}</p>
      </section>
      <ModelDetailPage model={model} />
    </>
  );
}
