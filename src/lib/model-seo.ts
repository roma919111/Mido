import type { CatalogModel } from "@/lib/model-catalog";
import { ALL_MODELS, getCatalogModel } from "@/lib/model-catalog";
import { createHrefForModel } from "@/lib/bottom-nav-models";

const BASE = "https://vyronix.app";

export function modelSlug(model: Pick<CatalogModel, "id">): string {
  return model.id.trim().toLowerCase();
}

export function findModelBySlug(slug: string): CatalogModel | undefined {
  const key = slug.trim().toLowerCase();
  return ALL_MODELS.find((m) => modelSlug(m) === key);
}

export function modelPagePath(model: Pick<CatalogModel, "id">): string {
  return `/models/${modelSlug(model)}`;
}

export function modelPageUrl(model: Pick<CatalogModel, "id">): string {
  return `${BASE}${modelPagePath(model)}`;
}

export function modelSeoTitle(model: CatalogModel, locale: "ar" | "en"): string {
  const kind = model.kind === "video" ? (locale === "ar" ? "فيديو" : "Video") : locale === "ar" ? "صورة" : "Image";
  return locale === "ar"
    ? `${model.name} — توليد ${kind} بالذكاء الاصطناعي | Veronix.ai`
    : `${model.name} — AI ${kind} Generation | Veronix.ai`;
}

export function modelSeoDescription(model: CatalogModel, locale: "ar" | "en"): string {
  const base =
    model.tagline ||
    (model.kind === "video"
      ? locale === "ar"
        ? `أنشئ فيديوهات ${model.name} من النص أو الصورة على Veronix.ai`
        : `Create ${model.name} videos from text or images on Veronix.ai`
      : locale === "ar"
        ? `أنشئ صور ${model.name} بالذكاء الاصطناعي على Veronix.ai`
        : `Create ${model.name} AI images on Veronix.ai`);
  const status = model.available
    ? locale === "ar"
      ? "متاح الآن"
      : "Available now"
    : locale === "ar"
      ? "قريبًا"
      : "Coming soon";
  return `${base} · ${status} · vyronix.app`;
}

export function modelSoftwareJsonLd(model: CatalogModel) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: model.name,
    applicationCategory: model.kind === "video" ? "VideoApplication" : "DesignApplication",
    operatingSystem: "Web",
    url: modelPageUrl(model),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: model.available ? "Try on Veronix.ai" : "Coming soon on Veronix.ai",
    },
    description: modelSeoDescription(model, "en"),
    potentialAction: {
      "@type": "UseAction",
      target: `${BASE}${createHrefForModel(model)}`,
    },
  };
}

export function allModelSlugs(): string[] {
  return ALL_MODELS.map((m) => modelSlug(m));
}

export function getCatalogModelBySlug(slug: string): CatalogModel | undefined {
  return getCatalogModel(slug) || findModelBySlug(slug);
}
