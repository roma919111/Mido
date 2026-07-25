/**
 * Fully rewrite a user prompt into a polished generation brief.
 * Always replaces the field contents (never appends polish onto prior polish).
 */

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

const ARABIC_POLISH_MARKERS = [
  "حركة كاميرا",
  "دفعة كاميرا",
  "دوران خفيف",
  "حركة طبيعية",
  "إيقاع أكشن",
  "تدفّق حركة",
  "إضاءة سينمائية",
  "أجواء درامية",
  "جودة إنتاج",
  "تكوين مركزي",
  "إطار سينمائي",
  "عزل نظيف",
  "إضاءة استوديو",
  "إضاءة درامية",
  "إضاءة طبيعية",
  "جودة فوتورياليستية",
  "لمسة إنتاج",
  "تباين متوازن",
  "مدة المشهد متماسكة",
];

const ENGLISH_POLISH_MARKERS = [
  "smooth tracking camera",
  "cinematic push-in",
  "subtle orbit move",
  "natural temporally consistent",
  "dynamic action pacing",
  "fluid cinematic motion",
  "cinematic lighting",
  "dramatic atmosphere",
  "premium production",
  "intentional centered framing",
  "cinematic composition",
  "hero framing",
  "soft studio lighting",
  "dramatic high-dynamic-range",
  "premium natural light",
  "photorealistic sharpness",
  "luxury finish",
  "balanced contrast",
  "cohesive shot",
  "Centered subject",
  "Smooth camera movement",
  "Refined for",
];

/** Recover the user's core idea before any previous polish layers. */
export function extractCoreIdea(prompt: string): string {
  let core = prompt.trim().replace(/\s+/g, " ");
  if (!core) return "";

  core = core.replace(
    /\.?\s*(Centered subject|Smooth camera movement|intentional framing|temporally consistent subject|photorealistic|soft volumetric light|clean background separation|premium production aesthetic|cinematic lighting|rich color grading|sharp detail|shallow depth of field|dramatic atmosphere|high dynamic range|filmic contrast|meticulous composition|studio-quality finish|coherent subject focus|natural motion cues|polished texture|Refined for .+? generation with tighter subject clarity and balanced lighting)\.?/gi,
    " ",
  );

  const markers = isArabic(core) ? ARABIC_POLISH_MARKERS : ENGLISH_POLISH_MARKERS;
  for (const marker of markers) {
    const idx = core.toLowerCase().indexOf(marker.toLowerCase());
    if (idx > 0) {
      core = core.slice(0, idx);
    }
  }

  return core
    .replace(/\s+/g, " ")
    .replace(/[.\s،,]+$/g, "")
    .trim();
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function videoRewriteAr(idea: string, seed: number): string {
  const cams = [
    "حركة كاميرا سلسة مع تتبّع للموضوع",
    "دفعة كاميرا سينمائية للأمام مع ثبات على الوجه",
    "دوران خفيف حول المشهد مع عمق ميداني ضحل",
  ];
  const motions = [
    "حركة طبيعية ومتّسقة زمنياً بلا تقطّع",
    "إيقاع أكشن ديناميكي مع انتقالات نظيفة",
    "تدفّق حركة سينمائي يحافظ على هوية الشخص/العنصر",
  ];
  const looks = [
    "إضاءة سينمائية وتدرّج ألوان غني وتفاصيل حادة",
    "أجواء درامية وتباين فيلمي وتكوين متقن",
    "جودة إنتاج عالية مع فصل واضح للخلفية",
  ];
  return [
    idea,
    cams[seed % cams.length],
    motions[(seed + 1) % motions.length],
    looks[(seed + 2) % looks.length],
    "مدة المشهد متماسكة، بدون تشويش أو عناصر عشوائية",
  ].join(". ");
}

function imageRewriteAr(idea: string, seed: number): string {
  const frames = [
    "تكوين مركزي واضح مع توازن بصري احترافي",
    "إطار سينمائي ونسبة ذهبية خفيفة في التكوين",
    "عزل نظيف للموضوع عن الخلفية مع عمق ميداني",
  ];
  const lights = [
    "إضاءة استوديو ناعمة مع لمسات حجمية",
    "إضاءة درامية عالية الديناميكية وتفاصيل دقيقة",
    "إضاءة طبيعية فاخرة مع ألوان متناسقة",
  ];
  const finishes = [
    "جودة فوتورياليستية حادة جاهزة للعرض",
    "لمسة إنتاج فاخرة ونسيج نظيف بدون تشويش",
    "تباين متوازن وحدّة احترافية في التفاصيل",
  ];
  return [
    idea,
    frames[seed % frames.length],
    lights[(seed + 1) % lights.length],
    finishes[(seed + 2) % finishes.length],
  ].join(". ");
}

function videoRewriteEn(idea: string, seed: number): string {
  const cams = [
    "smooth tracking camera with locked subject focus",
    "cinematic push-in with stable framing",
    "subtle orbit move and shallow depth of field",
  ];
  const motions = [
    "natural temporally consistent motion with no flicker",
    "dynamic action pacing and clean transitions",
    "fluid cinematic motion preserving identity",
  ];
  const looks = [
    "cinematic lighting, rich color grade, sharp detail",
    "dramatic atmosphere, filmic contrast, meticulous composition",
    "premium production finish with clean background separation",
  ];
  return [
    idea,
    cams[seed % cams.length],
    motions[(seed + 1) % motions.length],
    looks[(seed + 2) % looks.length],
    "cohesive shot, no random artifacts",
  ].join(", ");
}

function imageRewriteEn(idea: string, seed: number): string {
  const frames = [
    "intentional centered framing with professional balance",
    "cinematic composition and clean subject isolation",
    "hero framing with shallow depth of field",
  ];
  const lights = [
    "soft studio lighting with volumetric accents",
    "dramatic high-dynamic-range lighting and fine detail",
    "premium natural light and harmonious color",
  ];
  const finishes = [
    "photorealistic sharpness ready for display",
    "luxury finish, clean texture, no noise",
    "balanced contrast and crisp professional detail",
  ];
  return [
    idea,
    frames[seed % frames.length],
    lights[(seed + 1) % lights.length],
    finishes[(seed + 2) % finishes.length],
  ].join(", ");
}

/**
 * Returns a complete replacement prompt built from the user's core idea.
 */
export function enhancePrompt(prompt: string, mode: string): string {
  const idea = extractCoreIdea(prompt);
  if (!idea) return "";

  const seed = hashSeed(idea + mode);
  const video = mode.includes("video");
  const arabic = isArabic(idea);

  if (arabic) {
    return video ? videoRewriteAr(idea, seed) : imageRewriteAr(idea, seed);
  }
  return video ? videoRewriteEn(idea, seed) : imageRewriteEn(idea, seed);
}

export function enhancePromptVariant(prompt: string, mode: string, emphasis: string): string {
  const idea = extractCoreIdea(prompt);
  if (!idea) return "";
  const arabic = isArabic(idea);
  const emphasisLine = arabic
    ? /mood|texture/i.test(emphasis)
      ? "مع تركيز أقوى على المزاج والملمس البصري"
      : emphasis
    : emphasis;
  return enhancePrompt(`${idea}. ${emphasisLine}`, mode);
}
