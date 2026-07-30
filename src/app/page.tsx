import type { Metadata } from "next";
import { VeronixApp } from "@/components/veronix/VeronixApp";
import { getRequestDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.meta.titleDefault,
    description: t.meta.description,
    path: "/",
    absoluteTitle: true,
    ogTitle: t.meta.ogTitle,
  });
}

export default async function HomePage() {
  const { t, dir } = await getRequestDictionary();
  return (
    <>
      {/* Server-rendered crawlable content for Google (complements the client studio UI). */}
      <section className="sr-only" aria-hidden={false} dir={dir}>
        <h1>{t.meta.homeH1}</h1>
        <p>{t.meta.homeSeoP}</p>
        <ul>
          {t.meta.homeBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a href="/pricing">{t.footer.pricing}</a>
        <a href="/about">{t.footer.about}</a>
        <a href="/faq">{t.footer.faq}</a>
        <a href="/contact">{t.footer.contact}</a>
        <a href="/create/video">{t.nav.createVideo}</a>
        <a href="/create/image">{t.nav.createImage}</a>
        <a href="/signup">{t.header.signup}</a>
      </section>
      <VeronixApp />
    </>
  );
}
