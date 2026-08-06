import type { Metadata } from "next";
import { CreatePage } from "@/components/veronix/CreatePage";
import { getRequestDictionary } from "@/lib/i18n";
import { SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.create.videoTitle,
    description: t.create.videoSub,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: "https://vyronix.app/create/video" },
    openGraph: {
      title: t.create.videoTitle,
      description: t.create.videoSub,
      url: "https://vyronix.app/create/video",
    },
  };
}

export default function CreateVideoPage() {
  return <CreatePage media="video" />;
}
