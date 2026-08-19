import type { Metadata, Viewport } from "next";
import { MaxVronixMediaApp } from "@/components/iptv/MaxVronixMediaApp";
import {
  MEDIA_PLAYER_ACTIVATE_URL,
  MEDIA_PLAYER_PRICE_SAR,
} from "@/lib/media-player-commerce";
import "@/styles/max-show-iptv.css";

const TITLE = "Vyronix Max Media — مشغّل الميديا";
const DESCRIPTION =
  "افتح مشغّل Vyronix Max Media على المتصفح. فعّل الجهاز بـ 40 ريالاً سعودياً في السنة وشاهد على آيفون وآيباد وماك بوك وأندرويد.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: MEDIA_PLAYER_ACTIVATE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: MEDIA_PLAYER_ACTIVATE_URL,
    siteName: "Vyronix Max Media Player",
    images: [
      {
        url: "/promo/max-media/vyronix-max-media-hero.png",
        width: 1536,
        height: 1024,
        alt: "Vyronix Max Media Player",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/promo/max-media/vyronix-max-media-hero.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050a1e",
};

export default function MaxVyronixMediaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Vyronix Max Media",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "iOS, iPadOS, macOS, Android, Web",
    url: MEDIA_PLAYER_ACTIVATE_URL,
    inLanguage: "ar",
    offers: {
      "@type": "Offer",
      price: String(MEDIA_PLAYER_PRICE_SAR),
      priceCurrency: "SAR",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MaxVronixMediaApp />
    </>
  );
}
