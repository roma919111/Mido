import { ALL_MODELS } from "@/lib/model-catalog";
import { modelPageUrl } from "@/lib/model-seo";

const BASE = "https://vyronix.app";

/** Shared SEO keywords — model names help organic discovery. */
export const SEO_KEYWORDS = [
  "Veronix",
  "Veronix.ai",
  "vyronix.app",
  "VYRONIX",
  "AI video generator",
  "AI image generator",
  "text to video",
  "text to image",
  "توليد فيديو",
  "توليد صور",
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

export function modelNamesForSeo(): string[] {
  return ALL_MODELS.map((m) => m.name);
}

export function modelsItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Veronix.ai AI Models",
    description:
      "Image and video generation models available on Veronix.ai — VYRONIX, PixVerse, MiniMax H3, Gemini, Kling, and more.",
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
          `${model.name} ${model.kind} model on Veronix.ai${model.available ? "" : " (coming soon)"}`,
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
