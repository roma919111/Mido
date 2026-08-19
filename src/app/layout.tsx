import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { LocaleProvider } from "@/components/veronix/LocaleProvider";
import { EditStudioExportHost } from "@/components/veronix/EditStudioExportHost";
import { StoragePressureHost } from "@/components/veronix/StoragePressureHost";
import { AnalyticsScripts } from "@/components/veronix/AnalyticsScripts";
import { AnalyticsCapture } from "@/components/veronix/AnalyticsCapture";
import { ReferralCapture } from "@/components/veronix/ReferralCapture";
import { getRequestDictionary, localeDir } from "@/lib/i18n";
import { BRAND_DOMAIN, BRAND_EMAIL, BRAND_NAME, VYRONIX_SOCIAL_SAME_AS } from "@/lib/brand";
import { modelsItemListJsonLd, SEO_KEYWORDS } from "@/lib/seo";
import { Suspense } from "react";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return {
    metadataBase: new URL(BRAND_DOMAIN),
    title: {
      default: t.meta.titleDefault,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    applicationName: BRAND_NAME,
    keywords: SEO_KEYWORDS,
    authors: [{ name: BRAND_NAME, url: BRAND_DOMAIN }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    alternates: {
      canonical: BRAND_DOMAIN,
      languages: {
        ar: BRAND_DOMAIN,
        en: BRAND_DOMAIN,
        "x-default": BRAND_DOMAIN,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ar_SA",
      alternateLocale: locale === "en" ? ["ar_SA"] : ["en_US"],
      url: BRAND_DOMAIN,
      siteName: BRAND_NAME,
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      images: [
        {
          url: "/promo/poster.jpg",
          width: 1920,
          height: 1080,
          alt: BRAND_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: BRAND_NAME,
      description: t.meta.twitterDescription,
      images: ["/promo/poster.jpg"],
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: [
        { url: "/favicon-48.png?v=7", sizes: "48x48", type: "image/png" },
        { url: "/models/vyronix-icon-128.png?v=7", sizes: "128x128", type: "image/png" },
        { url: "/models/vyronix-icon-512.png?v=7", sizes: "512x512", type: "image/png" },
      ],
      shortcut: [{ url: "/favicon-48.png?v=7", type: "image/png" }],
      apple: [{ url: "/models/vyronix-icon-512.png?v=7", sizes: "180x180", type: "image/png" }],
    },
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
      name: BRAND_NAME,
      alternateName: ["Vyronix", "Veronix", "vyronix.app"],
      url: BRAND_DOMAIN,
      logo: `${BRAND_DOMAIN}/promo/poster.jpg`,
      email: BRAND_EMAIL,
      sameAs: VYRONIX_SOCIAL_SAME_AS,
      contactPoint: [
        {
          "@type": "ContactPoint",
          email: BRAND_EMAIL,
          contactType: "customer support",
          availableLanguage: ["Arabic", "English"],
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: BRAND_NAME,
      alternateName: ["Vyronix", "Veronix"],
      url: BRAND_DOMAIN,
      inLanguage: ["ar", "en"],
      publisher: { "@type": "Organization", name: BRAND_NAME },
      potentialAction: {
        "@type": "SearchAction",
        target: `${BRAND_DOMAIN}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: BRAND_NAME,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: BRAND_DOMAIN,
      inLanguage: ["ar", "en"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description:
          locale === "en"
            ? "Free Vyronix starter trial; paid plans via Stripe"
            : "تجربة Vyronix مجانية للبداية؛ باقات مدفوعة عبر Stripe",
      },
      description: t.meta.description,
    },
    modelsItemListJsonLd(),
  ];

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${syne.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden font-sans">
        <AnalyticsScripts />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LocaleProvider initialLocale={locale}>
          <Suspense fallback={null}>
            <ReferralCapture />
            <AnalyticsCapture />
          </Suspense>
          <EditStudioExportHost />
          <Suspense fallback={null}>
            <StoragePressureHost />
          </Suspense>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
