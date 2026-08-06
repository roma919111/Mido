import type { Metadata } from "next";
import { CreatePage } from "@/components/veronix/CreatePage";
import { getRequestDictionary } from "@/lib/i18n";
import { SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.create.imageTitle,
    description: t.create.imageSub,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/create/image" },
    openGraph: {
      title: t.create.imageTitle,
      description: t.create.imageSub,
      url: "https://vyronix.app/create/image",
    },
  };
}

export default function CreateImagePage() {
  return <CreatePage media="image" />;
}
