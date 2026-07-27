import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { WhatsAppSupport } from "@/components/veronix/WhatsAppSupport";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://vyronix.app"),
  title: {
    default: "Veronix.ai — استوديو الصور والفيديو بالذكاء الاصطناعي",
    template: "%s · Veronix.ai",
  },
  description:
    "Veronix.ai منصة رسمية على vyronix.app لتوليد الصور والفيديو بالذكاء الاصطناعي مع حسابات زبائن ومحفظة كريدت ودفع آمن عبر Stripe.",
  applicationName: "Veronix.ai",
  keywords: [
    "Veronix",
    "Veronix.ai",
    "vyronix.app",
    "AI video",
    "AI image",
    "توليد فيديو",
    "ذكاء اصطناعي",
  ],
  authors: [{ name: "Veronix.ai", url: "https://vyronix.app" }],
  creator: "Veronix.ai",
  publisher: "Veronix.ai",
  alternates: {
    canonical: "https://vyronix.app",
  },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    url: "https://vyronix.app",
    siteName: "Veronix.ai",
    title: "Veronix.ai — استوديو الصور والفيديو",
    description:
      "منصة رسمية لتوليد الصور والفيديو بالذكاء الاصطناعي على vyronix.app",
    images: [{ url: "/promo/poster.jpg", width: 1920, height: 1080, alt: "Veronix.ai" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Veronix.ai",
    description: "استوديو AI للصور والفيديو — vyronix.app",
    images: ["/promo/poster.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Veronix.ai",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: "https://vyronix.app",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free Veronix starter trial available; paid plans via Stripe",
      },
    },
  ];

  return (
    <html lang="ar" className={`${syne.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <WhatsAppSupport />
      </body>
    </html>
  );
}
