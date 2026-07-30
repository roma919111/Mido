import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { LocaleProvider } from "@/components/veronix/LocaleProvider";
import { PricingConfigHydrator } from "@/components/veronix/PricingConfigHydrator";
import { getRequestDictionary, localeDir } from "@/lib/i18n";
import {
  OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  languageAlternates,
} from "@/lib/seo";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t.meta.titleDefault,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    applicationName: SITE_NAME,
    keywords: t.meta.keywords,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "technology",
    alternates: languageAlternates("/"),
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ar_SA",
      alternateLocale: locale === "en" ? ["ar_SA"] : ["en_US"],
      url: SITE_URL,
      siteName: SITE_NAME,
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.ogTitle,
      description: t.meta.twitterDescription,
      images: [OG_IMAGE.url],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: "/favicon.ico",
    },
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getRequestDictionary();
  const dir = localeDir(locale);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}${OG_IMAGE.url}`,
      email: "support@vyronix.app",
      sameAs: [SITE_URL],
      contactPoint: [
        {
          "@type": "ContactPoint",
          email: "support@vyronix.app",
          contactType: "customer support",
          availableLanguage: ["Arabic", "English"],
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: ["ar", "en"],
      publisher: { "@type": "Organization", name: SITE_NAME },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      inLanguage: ["ar", "en"],
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "15",
        priceCurrency: "USD",
        offerCount: 3,
        description:
          locale === "en"
            ? "Free Veronix starter trial; paid plans from $10/mo via Stripe"
            : "تجربة Veronix مجانية للبداية؛ باقات مدفوعة من 10$ شهريًا عبر Stripe",
      },
      description: t.meta.description,
      featureList:
        locale === "en"
          ? [
              "AI image generation",
              "AI video generation",
              "Credit wallet",
              "Monthly plans",
              "Arabic and English UI",
            ]
          : [
              "توليد صور بالذكاء الاصطناعي",
              "توليد فيديو بالذكاء الاصطناعي",
              "محفظة كريدت",
              "باقات شهرية",
              "واجهة عربية وإنجليزية",
            ],
    },
  ];

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${syne.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LocaleProvider initialLocale={locale}>
          <PricingConfigHydrator />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
