import type { Metadata } from "next";
import { VeronixApp } from "@/components/veronix/VeronixApp";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: { absolute: t.meta.titleDefault },
    description: t.meta.description,
    keywords: [
      "vyronix",
      "veronix",
      "kling ai",
      "pixverse v6",
      "ai video generator",
      "text to video",
      "free ai video",
    ],
    alternates: {
      canonical: "https://vyronix.app/",
      languages: {
        ar: "https://vyronix.app/",
        en: "https://vyronix.app/",
        "x-default": "https://vyronix.app/",
      },
    },
    openGraph: {
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      url: "https://vyronix.app/",
    },
  };
}

export default async function HomePage() {
  const { t, dir } = await getRequestDictionary();
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/promo/poster-lcp.jpg"
        fetchPriority="high"
      />
      {/* Server-rendered crawlable content for Google (complements the client studio UI). */}
      <section className="sr-only" aria-hidden={false} dir={dir}>
        <h1>{t.meta.homeH1}</h1>
        <p>{t.meta.homeSeoP}</p>
        <ul>
          {t.meta.homeBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a href="/invite">{t.invite.title}</a>
        <a href="/pricing">{t.footer.pricing}</a>
        <a href="/models">{t.models.title}</a>
        <a href="/create/video">{t.create.videoTitle}</a>
        <a href="/create/image">{t.create.imageTitle}</a>
        <a href="/edit">{t.seoPages.editTitle}</a>
        <a href="/ai-video-generator">{t.seoLandings.aiVideo}</a>
        <a href="/ai-image-generator">{t.seoLandings.aiImage}</a>
        <a href="/text-to-video">{t.seoLandings.textToVideo}</a>
        <a href="/ai-video-editor">{t.seoLandings.aiEditor}</a>
        <a href="/about">{t.footer.about}</a>
        <a href="/faq">{t.footer.faq}</a>
        <a href="/contact">{t.footer.contact}</a>
        <a href="/signup">{t.header.signup}</a>
      </section>
      <VeronixApp />
    </>
  );
}
