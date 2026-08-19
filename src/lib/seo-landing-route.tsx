import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/veronix/SeoLandingPage";
import { getRequestDictionary } from "@/lib/i18n";
import {
  buildSeoLandingMetadata,
  getRelatedLandings,
  getSeoLanding,
  seoLandingJsonLd,
  type SeoLandingSlug,
} from "@/lib/seo-landings";

type Props = { slug: SeoLandingSlug };

export function createSeoLandingRoute(slug: SeoLandingSlug) {
  return {
    generateMetadata: async (): Promise<Metadata> => {
      const { locale } = await getRequestDictionary();
      return buildSeoLandingMetadata(slug, locale);
    },
    Page: async function SeoLandingRoutePage() {
      const { locale } = await getRequestDictionary();
      const landing = getSeoLanding(slug, locale);
      const related = getRelatedLandings(slug, locale);
      const jsonLd = seoLandingJsonLd(slug, locale);

      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <SeoLandingPage landing={landing} related={related} />
        </>
      );
    },
  };
}

export const aiVideoGeneratorRoute = createSeoLandingRoute("ai-video-generator");
export const aiImageGeneratorRoute = createSeoLandingRoute("ai-image-generator");
export const textToVideoRoute = createSeoLandingRoute("text-to-video");
export const aiVideoEditorRoute = createSeoLandingRoute("ai-video-editor");
