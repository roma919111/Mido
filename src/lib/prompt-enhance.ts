/**
 * Fully rewrite a user prompt into a polished generation brief.
 * Replaces the original text (does not append suffixes).
 */

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Strip leftover polish fragments from earlier enhance versions. */
function stripLegacyPolish(prompt: string): string {
  return prompt
    .replace(
      /\.?\s*(Centered subject|Smooth camera movement|intentional framing|temporally consistent subject|photorealistic|soft volumetric light|clean background separation|premium production aesthetic|cinematic lighting|rich color grading|sharp detail|shallow depth of field|dramatic atmosphere|high dynamic range|filmic contrast|meticulous composition|studio-quality finish|coherent subject focus|natural motion cues|polished texture|Refined for .+? generation with tighter subject clarity and balanced lighting)\.?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*\./g, ".")
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
    "مدة المشهد متماسكة، بدون تشويش أو عناصر عشوائية.",
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
 * Returns a complete replacement prompt (never appends to the original string as a suffix dump).
 */
export function enhancePrompt(prompt: string, mode: string): string {
  const cleaned = stripLegacyPolish(prompt.trim().replace(/\s+/g, " "));
  if (!cleaned) return "";

  const seed = hashSeed(cleaned + mode);
  const video = mode.includes("video");
  const arabic = isArabic(cleaned);

  if (arabic) {
    return video ? videoRewriteAr(cleaned, seed) : imageRewriteAr(cleaned, seed);
  }
  return video ? videoRewriteEn(cleaned, seed) : imageRewriteEn(cleaned, seed);
}

export function enhancePromptVariant(prompt: string, mode: string, emphasis: string): string {
  const base = stripLegacyPolish(prompt.trim().replace(/\s+/g, " "));
  if (!base) return "";
  const arabic = isArabic(base);
  const emphasisLine = arabic
    ? emphasis.includes("mood")
      ? "ركّز على المزاج والملمس البصري"
      : emphasis
    : emphasis;
  // Re-run full rewrite with emphasis folded into the idea (still a full replacement).
  return enhancePrompt(`${base}. ${emphasisLine}`, mode);
}
