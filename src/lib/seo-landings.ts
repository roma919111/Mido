import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";
import { breadcrumbJsonLd, pageOpenGraph, SEO_KEYWORDS } from "@/lib/seo";

export type SeoLandingSlug =
  | "ai-video-generator"
  | "ai-image-generator"
  | "text-to-video"
  | "ai-video-editor";

export type SeoLandingContent = {
  slug: SeoLandingSlug;
  path: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  intro: string[];
  features: string[];
  steps: Array<{ title: string; body: string }>;
  faq: Array<{ q: string; a: string }>;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  relatedTitle: string;
};

const LANDINGS: Record<SeoLandingSlug, Record<Locale, Omit<SeoLandingContent, "slug" | "path">>> = {
  "ai-video-generator": {
    ar: {
      metaTitle: "مولّد فيديو AI مجاني — Kling · PixVerse · Vyronix",
      metaDescription:
        "أنشئ فيديوهات AI مجانًا من النص أو الصورة — Kling · PixVerse · MiniMax · Seedance. أول فيديو Vyronix مجاني · 480p/720p · vyronix.app.",
      h1: "مولّد فيديو بالذكاء الاصطناعي",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "Vyronix AI Studio منصة ويب لتوليد فيديوهات احترافية بالذكاء الاصطناعي — اكتب وصف المشهد أو ارفع صورة مرجعية، واختر من موديلات VYRONIX وPixVerse وKling وMiniMax H3.",
        "مناسب لصنّاع المحتوى، المسوّقين، وروّاد الأعمال الذين يريدون فيديوهات قصيرة 4–15 ثانية بدون استوديو تقليدي. واجهة عربية وإنجليزية، ومحفظة كريدت شفافة قبل كل توليد.",
      ],
      features: [
        "Text-to-video و image-to-video",
        "موديلات: VYRONIX · PixVerse · Kling · Seedance · MiniMax",
        "480p و 720p — أول فيديو مجاني للحسابات الجديدة",
        "بدون تثبيت — يعمل من المتصفح على vyronix.app",
      ],
      steps: [
        { title: "سجّل مجانًا", body: "أنشئ حسابًا على vyronix.app — أول فيديو Vyronix مجاني مرة واحدة." },
        { title: "اختر فيديو + الموديل", body: "من استوديو الإنشاء، اكتب وصف المشهد والحركة أو ارفع إطارًا مرجعيًا." },
        { title: "Generate وحمّل", body: "انتظر التوليد ثم شاهد النتيجة في Assets أو حرّرها في استوديو التحرير." },
      ],
      faq: [
        {
          q: "هل يوجد فيديو AI مجاني؟",
          a: "نعم — أول فيديو Vyronix مجاني مرة واحدة للحسابات بدون رصيد، وفق الشروط المعروضة في الاستوديو.",
        },
        {
          q: "ما مدة الفيديو المتاحة؟",
          a: "من 4 إلى 15 ثانية حسب الموديل، بجودة 480p أو 720p.",
        },
      ],
      ctaPrimary: { label: "ابدأ إنشاء فيديو AI", href: "/create/video" },
      ctaSecondary: { label: "عرض الباقات", href: "/pricing" },
      relatedTitle: "أدلة ذات صلة",
    },
    en: {
      metaTitle: "Free AI Video Generator — Kling · PixVerse · Vyronix",
      metaDescription:
        "Create free AI videos from text or images — Kling · PixVerse · MiniMax · Seedance. Free first Vyronix video · 480p/720p · vyronix.app.",
      h1: "AI Video Generator",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "Vyronix AI Studio is a web platform for professional AI video generation — describe your scene or upload a reference image, then pick from VYRONIX, PixVerse, Kling, MiniMax H3, and more.",
        "Built for creators, marketers, and founders who need short 4–15s clips without a traditional studio. Bilingual Arabic/English UI with transparent credit pricing before every render.",
      ],
      features: [
        "Text-to-video and image-to-video",
        "Models: VYRONIX · PixVerse · Kling · Seedance · MiniMax",
        "480p and 720p — free first video for new accounts",
        "No install — runs in the browser at vyronix.app",
      ],
      steps: [
        { title: "Sign up free", body: "Create an account on vyronix.app — one free Vyronix video for new wallets." },
        { title: "Pick video + model", body: "In Create, describe motion and scene or upload a reference frame." },
        { title: "Generate & download", body: "Wait for the render, then open Assets or edit in the Edit Studio." },
      ],
      faq: [
        {
          q: "Is there a free AI video?",
          a: "Yes — one free Vyronix video for empty wallets, under the terms shown in the studio.",
        },
        {
          q: "How long can videos be?",
          a: "4–15 seconds depending on the model, at 480p or 720p.",
        },
      ],
      ctaPrimary: { label: "Start AI video", href: "/create/video" },
      ctaSecondary: { label: "View pricing", href: "/pricing" },
      relatedTitle: "Related guides",
    },
  },
  "ai-image-generator": {
    ar: {
      metaTitle: "مولّد صور AI مجاني — Flux · Reve · Vyronix",
      metaDescription:
        "أنشئ صور AI من النص — Flux · Reve · Seedream · VYRONIX. جودة 2K · بدون واترمارك على Vyronix · vyronix.app.",
      h1: "مولّد صور بالذكاء الاصطناعي",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "حوّل الوصف النصي إلى صور عالية الجودة بالذكاء الاصطناعي على Vyronix AI Studio. مناسب للمنتجات، الشخصيات، الخلفيات، ومحتوى السوشيال.",
        "اختر موديل الصور، اكتب prompt بالعربية أو الإنجليزية، واحصل على نتائج 2K جاهزة للتنزيل — بدون واترمارك على موديل VYRONIX.",
      ],
      features: [
        "Text-to-image و image-to-image",
        "جودة 2K — بدون واترمارك على VYRONIX",
        "وصف بالعربية أو الإنجليزية مع تحسين تلقائي",
        "تخزين في Assets — تنزيل ومشاركة فورية",
      ],
      steps: [
        { title: "افتح استوديو الصور", body: "من /create/image اختر موديل الصور المناسب." },
        { title: "اكتب الوصف", body: "صف الأسلوب، الإضاءة، والتفاصيل — أو ارفع صورة مرجعية." },
        { title: "Generate", body: "راجع الكريدت قبل التوليد، ثم حمّل الصورة من Assets." },
      ],
      faq: [
        {
          q: "هل الصور بدون واترمارك؟",
          a: "نعم على موديل VYRONIX للصور — راجع التفاصيل في الاستوديو قبل التوليد.",
        },
        {
          q: "هل أستطيع استخدام الصور تجاريًا؟",
          a: "راجع شروط الاستخدام — المحتوى الذي تنشئه يخضع لسياسات المنصة والقانون المحلي.",
        },
      ],
      ctaPrimary: { label: "ابدأ إنشاء صور AI", href: "/create/image" },
      ctaSecondary: { label: "استكشف الموديلات", href: "/models" },
      relatedTitle: "أدلة ذات صلة",
    },
    en: {
      metaTitle: "Free AI Image Generator — Flux · Reve · Vyronix",
      metaDescription:
        "Create AI images from text — Flux · Reve · Seedream · VYRONIX. 2K quality · no watermark on Vyronix · vyronix.app.",
      h1: "AI Image Generator",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "Turn text prompts into high-quality AI images on Vyronix AI Studio — ideal for products, characters, backgrounds, and social content.",
        "Pick an image model, write in Arabic or English, and download 2K results — no watermark on the VYRONIX image model.",
      ],
      features: [
        "Text-to-image and image-to-image",
        "2K output — no watermark on VYRONIX",
        "Arabic or English prompts with enhancement",
        "Saved to Assets — instant download & share",
      ],
      steps: [
        { title: "Open image studio", body: "Go to /create/image and pick a model." },
        { title: "Write your prompt", body: "Describe style, lighting, and details — or upload a reference." },
        { title: "Generate", body: "Review credits, render, then download from Assets." },
      ],
      faq: [
        {
          q: "Are images watermark-free?",
          a: "Yes on the VYRONIX image model — check the studio before generating.",
        },
        {
          q: "Can I use images commercially?",
          a: "See our terms — you are responsible for lawful use of generated content.",
        },
      ],
      ctaPrimary: { label: "Start AI images", href: "/create/image" },
      ctaSecondary: { label: "Browse models", href: "/models" },
      relatedTitle: "Related guides",
    },
  },
  "text-to-video": {
    ar: {
      metaTitle: "تحويل النص إلى فيديو AI — Text to Video · Vyronix",
      metaDescription:
        "حوّل النص إلى فيديو AI خلال دقائق — Kling · PixVerse · VYRONIX. prompts عربية وإنجليزية · أول فيديو مجاني · vyronix.app.",
      h1: "تحويل النص إلى فيديو (Text to Video)",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "Text-to-video يعني كتابة وصف للمشهد والحركة والحصول على فيديو مُولَّد بالذكاء الاصطناعي — بدون تصوير أو مونتاج يدوي.",
        "Vyronix AI Studio يدعم prompts بالعربية والإنجليزية مع موديلات VYRONIX وPixVerse وKling — من الفكرة إلى المعاينة خلال دقائق.",
      ],
      features: [
        "Prompts عربية وإنجليزية",
        "تحكم بالمدة والنسبة (9:16 · 16:9 · 1:1)",
        "توليد صوت اختياري على بعض الموديلات",
        "دمج مع استوديو التحرير للقص والترجمة",
      ],
      steps: [
        { title: "اكتب الوصف", body: "مثال: «لقطة سينمائية لشخص يمشي في شارع ممطر ليلاً»." },
        { title: "اختر الموديل والمدة", body: "VYRONIX أو PixVerse أو Kling — 4–15 ثانية." },
        { title: "Generate", body: "انتظر النتيجة وعدّلها في /edit إن رغبت." },
      ],
      faq: [
        {
          q: "هل العربية مدعومة في الوصف؟",
          a: "نعم — اكتب الوصف بالعربية أو الإنجليزية مباشرة في الاستوديو.",
        },
        {
          q: "ما الفرق عن image-to-video؟",
          a: "Text-to-video يبدأ من نص فقط؛ image-to-video يستخدم صورة مرجعية كإطار أول.",
        },
      ],
      ctaPrimary: { label: "جرّب Text to Video", href: "/create/video" },
      ctaSecondary: { label: "حساب مجاني", href: "/signup" },
      relatedTitle: "أدلة ذات صلة",
    },
    en: {
      metaTitle: "Text to Video AI — Kling · PixVerse · Vyronix",
      metaDescription:
        "Turn text into AI video in minutes — Kling · PixVerse · VYRONIX. Arabic & English prompts · free first video · vyronix.app.",
      h1: "Text to Video AI",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "Text-to-video means writing a scene description and getting an AI-generated clip — no camera or manual editing required.",
        "Vyronix AI Studio supports Arabic and English prompts with VYRONIX, PixVerse, and Kling — from idea to preview in minutes.",
      ],
      features: [
        "Arabic and English prompts",
        "Control duration and aspect (9:16 · 16:9 · 1:1)",
        "Optional audio on select models",
        "Edit in the studio for trim and subtitles",
      ],
      steps: [
        { title: "Write the prompt", body: "Example: “Cinematic shot of someone walking in a rainy street at night.”" },
        { title: "Pick model & duration", body: "VYRONIX, PixVerse, or Kling — 4–15 seconds." },
        { title: "Generate", body: "Wait for the render, then refine in /edit if needed." },
      ],
      faq: [
        {
          q: "Are Arabic prompts supported?",
          a: "Yes — write prompts in Arabic or English directly in the studio.",
        },
        {
          q: "How is this different from image-to-video?",
          a: "Text-to-video starts from text only; image-to-video uses a reference frame.",
        },
      ],
      ctaPrimary: { label: "Try text to video", href: "/create/video" },
      ctaSecondary: { label: "Free signup", href: "/signup" },
      relatedTitle: "Related guides",
    },
  },
  "ai-video-editor": {
    ar: {
      metaTitle: "محرر فيديو AI مجاني — قص · دمج · ترجمة · Vyronix",
      metaDescription:
        "حرّر ودمّج فيديوهات AI على جهازك — قص، فلاتر، ترجمة تلقائية، تصدير 1080p. بدون رفع على السيرفر · vyronix.app/edit",
      h1: "محرر فيديو بالذكاء الاصطناعي",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "استوديو التحرير في Vyronix AI Studio يتيح قص الفيديو، تغيير النسبة، فلاتر، ترجمة تلقائية، ودمج عدة مقاطع — المعالجة على جهازك عبر FFmpeg.wasm.",
        "مثالي بعد توليد فيديوهات AI من الاستوديو: عدّل، أضف ترجمة، وصدّر MP4 في تبويب جديد للمعاينة والتحميل.",
      ],
      features: [
        "قص ودمج timeline متعدد المقاطع",
        "ترجمة تلقائية (Gemini) — عربي/إنجليزي",
        "فلاتر ونسب عرض مختلفة",
        "تصدير على الجهاز — بدون رفع فيديو على السيرفر",
      ],
      steps: [
        { title: "افتح /edit", body: "أضف مقاطع من Assets أو ارفع فيديوهاتك." },
        { title: "حرّر", body: "قص، طبّق فلاتر، أو ولّد ترجمة للمقطع النشط." },
        { title: "Merge & Export", body: "دمج المقاطع وتصدير MP4 في تبويب متصفح جديد." },
      ],
      faq: [
        {
          q: "هل التحرير مجاني؟",
          a: "التحرير على جهازك لا يستهلك كريدت توليد — الترجمة التلقائية قد تستخدم API.",
        },
        {
          q: "هل يعمل على الموبايل؟",
          a: "يعمل على متصفحات حديثة؛ الأداء أفضل على Desktop للفيديوهات الطويلة.",
        },
      ],
      ctaPrimary: { label: "افتح استوديو التحرير", href: "/edit" },
      ctaSecondary: { label: "أنشئ فيديو AI أولًا", href: "/create/video" },
      relatedTitle: "أدلة ذات صلة",
    },
    en: {
      metaTitle: "Free AI Video Editor — Trim · Merge · Subtitles · Vyronix",
      metaDescription:
        "Edit AI videos on your device — trim, filters, auto subtitles, 1080p export. No server upload · vyronix.app/edit",
      h1: "AI Video Editor",
      eyebrow: "Vyronix AI Studio",
      intro: [
        "Vyronix Edit Studio lets you trim video, change aspect ratio, apply filters, auto-transcribe subtitles, and merge clips — processed on your device with FFmpeg.wasm.",
        "Perfect after generating AI clips: refine, subtitle, and export MP4 in a new browser tab for preview and download.",
      ],
      features: [
        "Multi-clip timeline trim & merge",
        "Auto subtitles (Gemini) — Arabic/English",
        "Filters and aspect ratios",
        "Client-side export — no video upload to server",
      ],
      steps: [
        { title: "Open /edit", body: "Add clips from Assets or upload your files." },
        { title: "Edit", body: "Trim, filter, or generate subtitles for the active clip." },
        { title: "Merge & export", body: "Combine clips and export MP4 in a new tab." },
      ],
      faq: [
        {
          q: "Is editing free?",
          a: "Client-side editing does not use generation credits — auto-transcribe may use API.",
        },
        {
          q: "Does it work on mobile?",
          a: "Works on modern browsers; desktop is better for longer videos.",
        },
      ],
      ctaPrimary: { label: "Open edit studio", href: "/edit" },
      ctaSecondary: { label: "Create AI video first", href: "/create/video" },
      relatedTitle: "Related guides",
    },
  },
};

export const ALL_SEO_LANDING_SLUGS: SeoLandingSlug[] = [
  "ai-video-generator",
  "ai-image-generator",
  "text-to-video",
  "ai-video-editor",
];

export function getSeoLanding(slug: SeoLandingSlug, locale: Locale): SeoLandingContent {
  const path = `/${slug}`;
  return { slug, path, ...LANDINGS[slug][locale] };
}

export function getRelatedLandings(slug: SeoLandingSlug, locale: Locale): SeoLandingContent[] {
  return ALL_SEO_LANDING_SLUGS.filter((s) => s !== slug).map((s) => getSeoLanding(s, locale));
}

export function buildSeoLandingMetadata(slug: SeoLandingSlug, locale: Locale): Metadata {
  const landing = getSeoLanding(slug, locale);
  return {
    title: { absolute: landing.metaTitle },
    description: landing.metaDescription,
    keywords: [...SEO_KEYWORDS, landing.h1, slug.replace(/-/g, " ")],
    alternates: { canonical: `${BRAND_DOMAIN}${landing.path}` },
    openGraph: pageOpenGraph(landing.path, landing.metaTitle, landing.metaDescription),
  };
}

export function seoLandingJsonLd(slug: SeoLandingSlug, locale: Locale) {
  const landing = getSeoLanding(slug, locale);
  return [
    breadcrumbJsonLd([
      { name: BRAND_NAME, path: "/" },
      { name: landing.h1, path: landing.path },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: landing.metaTitle,
      description: landing.metaDescription,
      url: `${BRAND_DOMAIN}${landing.path}`,
      inLanguage: locale,
      isPartOf: { "@type": "WebSite", name: BRAND_NAME, url: BRAND_DOMAIN },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: landing.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];
}

/** Short labels for cross-links and sitemap context. */
export function seoLandingNavLabel(slug: SeoLandingSlug, locale: Locale): string {
  return getSeoLanding(slug, locale).h1;
}
