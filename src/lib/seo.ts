import { ALL_MODELS } from "@/lib/model-catalog";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";
import { modelPageUrl } from "@/lib/model-seo";

const BASE = BRAND_DOMAIN;

/** Shared SEO keywords — model names help organic discovery. */
export const SEO_KEYWORDS = [
  "Vyronix",
  "Vyronix AI Studio",
  "vyronix.app",
  "VYRONIX",
  "Veronix",
  "AI video generator",
  "AI image generator",
  "AI video editor",
  "text to video",
  "ai video generator",
  "ai image generator",
  "text to image",
  "توليد فيديو",
  "توليد صور",
  "تحرير فيديو",
  "ذكاء اصطناعي",
  "MiniMax H3",
  "MiniMax",
  "PixVerse",
  "PixVerse V6",
  "Gemini Omni Flash",
  "Seedance",
  "Kling",
  "Grok Imagine",
  "Wan video",
  "Sora",
  "Veo",
  "Flux",
  "GPT Image",
  "AI studio Arabic",
  "استوديو ذكاء اصطناعي",
];

export function pageOpenGraph(path: string, title: string, description: string) {
  return {
    title,
    description,
    url: `${BASE}${path}`,
    siteName: BRAND_NAME,
  };
}

export function modelNamesForSeo(): string[] {
  return ALL_MODELS.map((m) => m.name);
}

export function modelsItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${BRAND_NAME} AI Models`,
    description: `Image and video generation models on ${BRAND_NAME} — VYRONIX, PixVerse, MiniMax H3, Gemini, Kling, and more.`,
    numberOfItems: ALL_MODELS.length,
    itemListElement: ALL_MODELS.map((model, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: model.name,
        applicationCategory: model.kind === "video" ? "VideoApplication" : "DesignApplication",
        operatingSystem: "Web",
        url: modelPageUrl(model),
        description:
          model.tagline ||
          `${model.name} ${model.kind} model on ${BRAND_NAME}${model.available ? "" : " (coming soon)"}`,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BASE}${item.path}`,
    })),
  };
}
