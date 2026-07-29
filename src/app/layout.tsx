import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { LocaleProvider } from "@/components/veronix/LocaleProvider";
import { PricingConfigHydrator } from "@/components/veronix/PricingConfigHydrator";
import { getRequestDictionary, localeDir } from "@/lib/i18n";
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
    metadataBase: new URL("https://vyronix.app"),
    title: {
      default: t.meta.titleDefault,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    applicationName: "Veronix.ai",
    keywords: [
      "Veronix",
      "Veronix.ai",
      "vyronix.app",
      "AI video",
      "AI image",
      "توليد فيديو",
      "ذكاء اصطناعي",
      "AI studio",
    ],
    authors: [{ name: "Veronix.ai", url: "https://vyronix.app" }],
    creator: "Veronix.ai",
    publisher: "Veronix.ai",
    alternates: {
      canonical: "https://vyronix.app",
      languages: {
        ar: "https://vyronix.app",
        en: "https://vyronix.app",
        "x-default": "https://vyronix.app",
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ar_SA",
      alternateLocale: locale === "en" ? ["ar_SA"] : ["en_US"],
      url: "https://vyronix.app",
      siteName: "Veronix.ai",
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      images: [
        {
          url: "/promo/poster.jpg",
          width: 1920,
          height: 1080,
          alt: "Veronix.ai",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Veronix.ai",
      description: t.meta.twitterDescription,
      images: ["/promo/poster.jpg"],
    },
    robots: {
      index: true,
      follow: true,
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
      name: "Veronix.ai",
      url: "https://vyronix.app",
      logo: "https://vyronix.app/promo/poster.jpg",
      email: "support@vyronix.app",
      sameAs: ["https://vyronix.app"],
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
      name: "Veronix.ai",
      url: "https://vyronix.app",
      inLanguage: ["ar", "en"],
      publisher: { "@type": "Organization", name: "Veronix.ai" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://vyronix.app/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Veronix.ai",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: "https://vyronix.app",
      inLanguage: ["ar", "en"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description:
          locale === "en"
            ? "Free Veronix starter trial; paid plans via Stripe"
            : "تجربة Veronix مجانية للبداية؛ باقات مدفوعة عبر Stripe",
      },
      description: t.meta.description,
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
