import type { Metadata } from "next";
import { CreatePage } from "@/components/veronix/CreatePage";
import { getRequestDictionary } from "@/lib/i18n";
import { pageOpenGraph, SEO_KEYWORDS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const title =
    locale === "ar"
      ? "إنشاء فيديو AI — Kling · PixVerse · Vyronix"
      : "Create AI Video — Kling · PixVerse · Vyronix";
  const description =
    locale === "ar"
      ? "أنشئ فيديو AI من النص أو الصورة — Kling · PixVerse · MiniMax · VYRONIX. أول فيديو مجاني · 480p/720p · vyronix.app."
      : "Create AI video from text or images — Kling · PixVerse · MiniMax · VYRONIX. Free first video · 480p/720p · vyronix.app.";

  return {
    title: { absolute: title },
    description,
    keywords: [...SEO_KEYWORDS, "kling ai", "pixverse v6", "text to video", "vyronix"],
    alternates: { canonical: "https://vyronix.app/create/video" },
    openGraph: pageOpenGraph("/create/video", title, description),
  };
}

export default function CreateVideoPage() {
  return <CreatePage media="video" />;
}
