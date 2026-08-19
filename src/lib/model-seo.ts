import type { CatalogModel } from "@/lib/model-catalog";
import { ALL_MODELS, getCatalogModel } from "@/lib/model-catalog";
import { createHrefForModel } from "@/lib/bottom-nav-models";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";

const BASE = BRAND_DOMAIN;

/** Search terms from Google Search Console — woven into titles/descriptions. */
const MODEL_SEARCH_ALIASES: Partial<Record<string, string[]>> = {
  vyronix: ["vyronix", "veronix", "vyronix ai"],
  "pixverse-v6": ["pixverse v6", "pixverse ai"],
  "kling-2-5": ["kling 2.5", "kling2.5", "kling ai"],
  "kling-2-1": ["kling 2.1", "klingai 2.1"],
  "kling-3-omni": ["kling 3 omni", "kling omni"],
  "flux-3-video": ["flux 3", "flux video", "flux bfl"],
  "flux-2-klein-9b": ["flux 9b", "flux klein 9b"],
  "flux-2-lora-gallery": ["flux 2 lora", "flux realism"],
  "reve-2-1": ["reve 2.1", "reve ai"],
  "wan-2-6": ["wan 2.6", "wan ai"],
  "wan-2-7": ["wan 2.7"],
  "minimax-h3": ["minimax h3", "minimax video"],
  "seedance-2": ["seedance 2", "seedance ai"],
  "seedance-2-fast": ["seedance 2 fast"],
  "gemini-omni-flash": ["gemini omni flash"],
};

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

export function modelSearchKeywords(model: CatalogModel): string[] {
  const aliases = MODEL_SEARCH_ALIASES[model.id] ?? [];
  return [...new Set([model.name, model.id.replace(/-/g, " "), ...aliases])];
}

export function modelSeoTitle(model: CatalogModel, locale: "ar" | "en"): string {
  const kind =
    model.kind === "video"
      ? locale === "ar"
        ? "فيديو AI"
        : "AI Video"
      : locale === "ar"
        ? "صورة AI"
        : "AI Image";

  if (locale === "ar") {
    const suffix = model.available ? " · مجاني على Vyronix" : " · Vyronix";
    return `${model.name} — ${kind}${suffix}`;
  }

  const suffix = model.available ? " · Free on Vyronix" : " · Vyronix";
  return `${model.name} — ${kind}${suffix}`;
}

export function modelSeoDescription(model: CatalogModel, locale: "ar" | "en"): string {
  const aliases = MODEL_SEARCH_ALIASES[model.id]?.slice(0, 3).join(locale === "ar" ? " · " : ", ");
  const action =
    model.kind === "video"
      ? locale === "ar"
        ? `أنشئ فيديو ${model.name} من النص أو الصورة`
        : `Create ${model.name} videos from text or images`
      : locale === "ar"
        ? `أنشئ صور ${model.name} من النص`
        : `Create ${model.name} AI images from text`;

  const status = model.available
    ? locale === "ar"
      ? "متاح الآن"
      : "Available now"
    : locale === "ar"
      ? "قريبًا"
      : "Coming soon";

  const trial =
    model.available && model.kind === "video"
      ? locale === "ar"
        ? " · أول فيديو مجاني"
        : " · free first video"
      : "";

  const aliasPart = aliases
    ? locale === "ar"
      ? ` · ${aliases}`
      : ` Keywords: ${aliases}.`
    : "";

  return `${action} on ${BRAND_NAME}${aliasPart} · ${status}${trial} · vyronix.app`;
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
      description: model.available ? `Try on ${BRAND_NAME}` : `Coming soon on ${BRAND_NAME}`,
    },
    description: modelSeoDescription(model, "en"),
    keywords: modelSearchKeywords(model).join(", "),
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
