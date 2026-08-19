import type { Metadata } from "next";
import { MediaPlayerLanding } from "@/components/iptv/MediaPlayerLanding";
import {
  MEDIA_PLAYER_LANDING_URL,
  MEDIA_PLAYER_PRICE_SAR,
  MEDIA_PLAYER_PRODUCT_NAME,
  MEDIA_PLAYER_PRODUCT_NAME_AR,
} from "@/lib/media-player-commerce";
import "@/styles/media-player-landing.css";

export const dynamic = "force-dynamic";

const TITLE = `${MEDIA_PLAYER_PRODUCT_NAME_AR} — مشغّل ميديا سنوي 40 ر.س`;
const DESCRIPTION =
  `مشغّل ${MEDIA_PLAYER_PRODUCT_NAME_AR} يشغّل اشتراكات الميديا الشائعة مثل إيليا برو وماكس TV. 40 ريالاً سعودياً في السنة. أرسل Host و Username و Password للدعم وشاهد على آيفون وآيباد وماك بوك وأندرويد.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: MEDIA_PLAYER_PRODUCT_NAME,
  authors: [{ name: MEDIA_PLAYER_PRODUCT_NAME, url: MEDIA_PLAYER_LANDING_URL }],
  creator: MEDIA_PLAYER_PRODUCT_NAME,
  publisher: MEDIA_PLAYER_PRODUCT_NAME,
  keywords: [
    MEDIA_PLAYER_PRODUCT_NAME,
    MEDIA_PLAYER_PRODUCT_NAME_AR,
    "Max Media",
    "مشغل ميديا",
    "IPTV",
  ],
  alternates: { canonical: MEDIA_PLAYER_LANDING_URL },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: MEDIA_PLAYER_LANDING_URL,
    siteName: MEDIA_PLAYER_PRODUCT_NAME,
    images: [{ url: "/promo/max-media/vyronix-max-media-hero.png", width: 1536, height: 1024, alt: MEDIA_PLAYER_PRODUCT_NAME_AR }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/promo/max-media/vyronix-max-media-hero.png"],
  },
};

export default function MediaPlayerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: MEDIA_PLAYER_PRODUCT_NAME,
    alternateName: MEDIA_PLAYER_PRODUCT_NAME_AR,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "iOS, iPadOS, macOS, Android, Web",
    url: MEDIA_PLAYER_LANDING_URL,
    inLanguage: "ar",
    offers: {
      "@type": "Offer",
      price: String(MEDIA_PLAYER_PRICE_SAR),
      priceCurrency: "SAR",
      description: `اشتراك سنوي لمشغّل ${MEDIA_PLAYER_PRODUCT_NAME_AR} — 40 ريالاً سعودياً`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MediaPlayerLanding />
    </>
  );
}
