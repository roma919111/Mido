import type { Metadata } from "next";
import { CANONICAL_APP_ORIGIN } from "@/lib/app-url";
import type { Locale } from "@/lib/i18n/dictionaries";

export const SITE_URL = CANONICAL_APP_ORIGIN;
export const SITE_NAME = "Veronix.ai";
export const OG_IMAGE_PATH = "/promo/poster.jpg";
/** Actual pixel size of `public/promo/poster.jpg` (PNG bytes). */
export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: 1536,
  height: 1024,
  alt: "Veronix.ai — AI image & video studio",
  type: "image/png",
} as const;

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function languageAlternates(path = "/"): Metadata["alternates"] {
  const url = absoluteUrl(path);
  return {
    canonical: url,
    languages: {
      ar: url,
      en: url,
      "x-default": url,
    },
  };
}

type PageMetaInput = {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  /** When true, use absolute title (skip "%s · Veronix.ai" template). */
  absoluteTitle?: boolean;
  index?: boolean;
  follow?: boolean;
  ogTitle?: string;
};

/** Consistent page metadata: canonical, hreflang, Open Graph, Twitter. */
export function buildPageMetadata({
  locale,
  title,
  description,
  path,
  absoluteTitle = false,
  index = true,
  follow = true,
  ogTitle,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const displayTitle = ogTitle || title;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: languageAlternates(path),
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ar_SA",
      alternateLocale: locale === "en" ? ["ar_SA"] : ["en_US"],
      url,
      siteName: SITE_NAME,
      title: displayTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description,
      images: [OG_IMAGE_PATH],
    },
    robots: { index, follow },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
