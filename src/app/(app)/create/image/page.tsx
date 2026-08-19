import type { Metadata } from "next";
import { CreatePage } from "@/components/veronix/CreatePage";
import { getRequestDictionary } from "@/lib/i18n";
import { pageOpenGraph, SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const title =
    locale === "ar"
      ? "إنشاء صور AI — Flux · Reve · Vyronix"
      : "Create AI Images — Flux · Reve · Vyronix";
  const description =
    locale === "ar"
      ? "أنشئ صور AI من النص — Flux · Reve · Seedream · VYRONIX. جودة 2K · vyronix.app."
      : "Create AI images from text — Flux · Reve · Seedream · VYRONIX. 2K quality · vyronix.app.";

  return {
    title: { absolute: title },
    description,
    keywords: [...SEO_KEYWORDS, "flux ai", "reve 2.1", "text to image", "vyronix"],
    alternates: { canonical: "https://vyronix.app/create/image" },
    openGraph: pageOpenGraph("/create/image", title, description),
  };
}

export default function CreateImagePage() {
  return <CreatePage media="image" />;
}
