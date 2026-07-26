/**
 * Context-aware prompt enhancer.
 * Rewrites the user's core idea into a cinematic generation brief
 * based on subject, action, setting, and secondary motion physics.
 * Always replaces the field contents (never appends polish onto prior polish).
 *
 * Advanced path (enhancePromptWithContext):
 * 1) Vision entity matching from uploaded reference images
 * 2) State continuity / prompt chaining across sequential actions
 */

import {
  buildChainedIdea,
  buildSceneState,
  type SceneState,
} from "@/lib/prompt-chain";
import {
  analyzeReferenceImages,
  entityPhrasesFromBrief,
  formatEntityBrief,
  type VisionSceneBrief,
} from "@/lib/prompt-vision";

export type SceneAnalysis = {
  idea: string;
  arabic: boolean;
  hasPerson: boolean;
  hasAnimal: boolean;
  actionKey: string | null;
  motion: "still" | "gentle" | "dynamic" | "intense";
  settingKey: string | null;
  moodKey: string | null;
  weatherKey: string | null;
};

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
  "مشهد سينمائي واقعي",
  "تفاصيل ثانوية من سياق الحركة",
  "كاميرا تتبّع سلسة",
  "إضاءة طبيعية سينمائية",
  "بدون عناصر عشوائية",
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
  "cinematic realistic scene",
  "secondary motion details",
  "smooth tracking shot",
  "natural cinematic lighting",
  "no random artifacts",
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

function pick<T>(items: T[], seed: number, salt = 0): T {
  return items[(seed + salt) % items.length]!;
}

type ActionRule = {
  key: string;
  motion: SceneAnalysis["motion"];
  ar: RegExp;
  en: RegExp;
  secondaryAr: string[];
  secondaryEn: string[];
};

const ACTION_RULES: ActionRule[] = [
  {
    key: "run",
    motion: "intense",
    ar: /يركض|يجري|عدو|جري|ركض|ينطلق/,
    en: /\b(runn?ing|runs|sprint(?:ing)?|dashes?|racing)\b/i,
    secondaryAr: [
      "شعره يتطاير بقوة مع سرعة الجري",
      "ملابسه ترفرف للخلف بفعل الهواء",
      "غبار خفيف يتصاعد من خطواته السريعة",
    ],
    secondaryEn: [
      "hair whipping hard with the sprint",
      "clothes fluttering backward from the wind",
      "light dust kicking up from each fast step",
    ],
  },
  {
    key: "walk",
    motion: "gentle",
    ar: /يتمش[ىي]|يمشي|ماشي|مشي|يتجوّل|يتجول|يسير/,
    en: /\b(walk(?:ing|s)?|stroll(?:ing)?|paces?|saunters?)\b/i,
    secondaryAr: [
      "شعره يتحرك ويتطاير بلطف مع كل خطوة حسب اتجاه الهواء",
      "ملابس خفيفة تتمايل طبيعياً مع حركة المشي",
      "ظلّه يتحرك معه على الأرض بإيقاع هادئ",
    ],
    secondaryEn: [
      "hair gently lifting and drifting with each step according to the breeze",
      "light clothing swaying naturally with the walking rhythm",
      "his shadow moving with him across the ground in a calm cadence",
    ],
  },
  {
    key: "drive",
    motion: "dynamic",
    ar: /يقود|قيادة|سيارة|دراجة نارية|موتوسيكل/,
    en: /\b(driv(?:e|ing)|motorcycle|car ride|speeding)\b/i,
    secondaryAr: [
      "الهواء يضرب الوجه والشعر بقوة بسبب السرعة",
      "انعكاسات الضوء تتحرك على الجسم والمعدن",
      "الضبابية الخلفية توحي بالحركة السريعة",
    ],
    secondaryEn: [
      "wind slamming into face and hair from the speed",
      "moving light reflections across body and metal",
      "background motion blur suggesting fast travel",
    ],
  },
  {
    key: "fly",
    motion: "intense",
    ar: /يطير|تحليق|يحلق|طيران/,
    en: /\b(fly(?:ing)?|soaring|hover(?:ing)?)\b/i,
    secondaryAr: [
      "الشعر والملابس يندفعان بقوة مع تيارات الهواء",
      "غبار أو سحب خفيفة تتفرق حول المسار",
      "إحساس بالارتفاع والفضاء المفتوح حول الجسم",
    ],
    secondaryEn: [
      "hair and clothes surging hard against air currents",
      "light dust or clouds parting around the flight path",
      "a strong sense of altitude and open space around the body",
    ],
  },
  {
    key: "swim",
    motion: "dynamic",
    ar: /يسبح|سباحة|يغوص|غطس/,
    en: /\b(swimm?(?:ing)?|dives?|diving|underwater)\b/i,
    secondaryAr: [
      "فقاعات ماء تتصاعد حول الجسم",
      "الشعر يطفو ويتموّج تحت الماء",
      "انعكاسات الضوء تتكسر على سطح الماء",
    ],
    secondaryEn: [
      "air bubbles rising around the body",
      "hair floating and waving underwater",
      "broken light caustics shimmering through the water",
    ],
  },
  {
    key: "dance",
    motion: "dynamic",
    ar: /يرقص|رقص|يتمايل/,
    en: /\b(danc(?:e|ing)|twirl(?:ing)?)\b/i,
    secondaryAr: [
      "الشعر والقماش يدوران مع إيقاع الرقصة",
      "حركة اليدين والجسم متناغمة وسلسة",
      "طيات الملابس ترسم أقواساً ديناميكية",
    ],
    secondaryEn: [
      "hair and fabric spinning with the dance rhythm",
      "hands and body moving in fluid harmony",
      "clothing folds drawing dynamic arcs in the air",
    ],
  },
  {
    key: "fight",
    motion: "intense",
    ar: /يقاتل|قتال|يلكم|يضرب|مبارزة|أكشن/,
    en: /\b(fight(?:ing)?|combat|punch(?:ing)?|battle|action scene)\b/i,
    secondaryAr: [
      "حركة سريعة وحادة مع طاقة عالية في الجسم",
      "الشعر والملابس يستجيبان لكل ضربة واندفاع",
      "غبار أو شرر خفيف حسب قوة المشهد",
    ],
    secondaryEn: [
      "sharp high-energy body motion",
      "hair and clothes reacting to every strike and lunge",
      "light dust or sparks matching the impact energy",
    ],
  },
  {
    key: "sit",
    motion: "still",
    ar: /يجلس|جالس|جلوس|مستلقي|ينام/,
    en: /\b(sit(?:ting)?|seated|lying|sleep(?:ing)?|rest(?:ing)?)\b/i,
    secondaryAr: [
      "وضعية مريحة بتفاصيل دقيقة في اليدين والكتفين",
      "حركة تنفس خفيفة جداً تحافظ على الحياة في المشهد",
      "القماش يستقر بثنيات طبيعية حول الجسم",
    ],
    secondaryEn: [
      "relaxed posture with fine hand and shoulder detail",
      "very subtle breathing motion keeping the scene alive",
      "fabric settling into natural folds around the body",
    ],
  },
  {
    key: "look",
    motion: "still",
    ar: /ينظر|يتطلع|يحدّق|يحدق|يبتسم/,
    en: /\b(look(?:ing)?|gaz(?:e|ing)|stares?|smil(?:e|ing))\b/i,
    secondaryAr: [
      "تعبير وجه واضح ومقنع",
      "لمعة خفيفة في العينين تعكس الإضاءة",
      "حركة بسيطة في الرأس أو الشعر فقط",
    ],
    secondaryEn: [
      "clear convincing facial expression",
      "soft catchlights in the eyes from the scene lighting",
      "only subtle head or hair micro-motion",
    ],
  },
];

type SettingRule = {
  key: string;
  ar: RegExp;
  en: RegExp;
  lineAr: string[];
  lineEn: string[];
};

const SETTING_RULES: SettingRule[] = [
  {
    key: "desert",
    ar: /صحراء|رمل|كثبان/,
    en: /\b(desert|sand dunes?|sandy)\b/i,
    lineAr: [
      "خلفية صحراوية متسعة مع حرارة خفيفة وغبار ناعم في الهواء",
      "أفق صحراوي مفتوح وألوان ترابية دافئة",
    ],
    lineEn: [
      "wide desert backdrop with heat haze and fine dust in the air",
      "open sandy horizon with warm earthy tones",
    ],
  },
  {
    key: "city",
    ar: /مدينة|شارع|طريق|سيتي|نيون/,
    en: /\b(city|street|urban|neon|downtown)\b/i,
    lineAr: [
      "خلفية مدينة حيّة مع عمق منظور ولمعات خفيفة في الخلفية",
      "شارع حضري مع انعكاسات وإيقاع بصري عصري",
    ],
    lineEn: [
      "lively city depth with soft bokeh lights in the background",
      "urban street with reflective surfaces and modern visual rhythm",
    ],
  },
  {
    key: "beach",
    ar: /بحر|شاطئ|موج|ساحل/,
    en: /\b(beach|ocean|sea|waves?|coast)\b/i,
    lineAr: [
      "شاطئ مفتوح مع نسيم ملحي وموج هادئ في الخلفية",
      "ضوء بحر ساطع وانعكاسات لامعة على الماء",
    ],
    lineEn: [
      "open beach with salty breeze and soft waves behind",
      "bright coastal light with shimmering water reflections",
    ],
  },
  {
    key: "forest",
    ar: /غابة|أشجار|طبيعة|جبل/,
    en: /\b(forest|woods|trees|mountain|nature)\b/i,
    lineAr: [
      "طبيعة غنية بأشجار وخضرة وعمق ميداني ناعم",
      "هواء نقي وضوء يتسرّب بين الأغصان",
    ],
    lineEn: [
      "lush nature with trees, greenery, and soft depth",
      "fresh air and light filtering through branches",
    ],
  },
  {
    key: "rain",
    ar: /مطر|ممطر|عاصفة/,
    en: /\b(rain(?:y)?|storm|downpour)\b/i,
    lineAr: [
      "مطر خفيف يلمع على الشعر والملابس والأسطح",
      "رطوبة بصرية مع انعكاسات لامعة من القطرات",
    ],
    lineEn: [
      "light rain glistening on hair, clothes, and surfaces",
      "wet atmosphere with bright droplet reflections",
    ],
  },
  {
    key: "night",
    ar: /ليل|منتصف الليل|ظلام/,
    en: /\b(night|midnight|dark alley)\b/i,
    lineAr: [
      "ليل سينمائي مع إضاءة محيطية خافتة وتباين درامي",
      "أجواء ليلية عميقة مع نقاط ضوء دقيقة في الخلفية",
    ],
    lineEn: [
      "cinematic night with soft ambient light and dramatic contrast",
      "deep night mood with tiny practical lights in the background",
    ],
  },
  {
    key: "studio",
    ar: /استوديو|خلفية نظيفة|بورتريه/,
    en: /\b(studio|clean background|portrait backdrop)\b/i,
    lineAr: [
      "خلفية استوديو نظيفة مع إضاءة مضبوطة وعزل واضح للموضوع",
    ],
    lineEn: [
      "clean studio backdrop with controlled lighting and clear subject isolation",
    ],
  },
];

const PERSON_AR = /رجل|امرأة|امرأه|ولد|بنت|شخص|شاب|فتاة|طفل|إنسان|رجلين|رجال|نساء/;
const PERSON_EN =
  /\b(man|woman|boy|girl|person|people|guy|lady|child|human|male|female|character)\b/i;
const ANIMAL_AR = /حصان|كلب|قط|أسد|نمر|طائر|عصفور|ذئب|جمل/;
const ANIMAL_EN = /\b(horse|dog|cat|lion|tiger|bird|wolf|camel|animal)\b/i;

const MOOD_RULES: Array<{
  key: string;
  ar: RegExp;
  en: RegExp;
  lineAr: string;
  lineEn: string;
}> = [
  {
    key: "epic",
    ar: /ملحمي|أسطوري|بطولي|درامي/,
    en: /\b(epic|legendary|heroic|dramatic)\b/i,
    lineAr: "مزاج درامي ملحمي وتباين سينمائي قوي",
    lineEn: "epic dramatic mood with strong cinematic contrast",
  },
  {
    key: "calm",
    ar: /هادئ|سلام|رومانسي|ناعم/,
    en: /\b(calm|peaceful|romantic|soft|gentle)\b/i,
    lineAr: "مزاج هادئ دافئ بتفاصيل ناعمة",
    lineEn: "calm warm mood with soft intimate detail",
  },
  {
    key: "dark",
    ar: /مظلم|غامض|رعب|مرعب/,
    en: /\b(dark|mystery|horror|eerie|moody)\b/i,
    lineAr: "مزاج غامض مظلم بظلال عميقة",
    lineEn: "dark mysterious mood with deep shadows",
  },
];

export function analyzeScene(idea: string): SceneAnalysis {
  const arabic = isArabic(idea);
  const action = ACTION_RULES.find((r) => (arabic ? r.ar : r.en).test(idea)) ?? null;
  const setting = SETTING_RULES.find((r) => (arabic ? r.ar : r.en).test(idea)) ?? null;
  const mood = MOOD_RULES.find((r) => (arabic ? r.ar : r.en).test(idea)) ?? null;
  const weather =
    SETTING_RULES.find((r) => r.key === "rain" && (arabic ? r.ar : r.en).test(idea)) ??
    null;

  return {
    idea,
    arabic,
    hasPerson: arabic ? PERSON_AR.test(idea) : PERSON_EN.test(idea),
    hasAnimal: arabic ? ANIMAL_AR.test(idea) : ANIMAL_EN.test(idea),
    actionKey: action?.key ?? null,
    motion: action?.motion ?? "gentle",
    settingKey: setting?.key ?? null,
    moodKey: mood?.key ?? null,
    weatherKey: weather?.key ?? null,
  };
}

function secondaryLines(analysis: SceneAnalysis, seed: number): string[] {
  const action = ACTION_RULES.find((r) => r.key === analysis.actionKey);
  if (!action) {
    if (analysis.hasPerson) {
      return analysis.arabic
        ? [pick(["تفاصيل وجه دقيقة وتعبير طبيعي", "ملمس بشرة وملابس واقعي بدون مبالغة"], seed)]
        : [pick(["fine facial detail and natural expression", "realistic skin and clothing texture"], seed)];
    }
    return analysis.arabic
      ? [pick(["تفاصيل مادّية دقيقة وإحساس واقعي بالمشهد", "عمق بصري واضح بدون فوضى"], seed)]
      : [pick(["precise material detail and realistic scene presence", "clear visual depth without clutter"], seed)];
  }

  const pool = analysis.arabic ? action.secondaryAr : action.secondaryEn;
  const a = pick(pool, seed, 0);
  const b = pick(pool, seed, 1);
  return a === b ? [a] : [a, b];
}

function settingLine(analysis: SceneAnalysis, seed: number): string | null {
  const setting = SETTING_RULES.find((r) => r.key === analysis.settingKey);
  if (!setting) {
    if (analysis.arabic) {
      return pick(
        [
          "بيئة متماسكة تخدم المشهد بدون عناصر مشتّتة",
          "خلفية طبيعية متناسقة مع حركة الموضوع",
        ],
        seed,
        3,
      );
    }
    return pick(
      [
        "cohesive environment that supports the scene without distractions",
        "background naturally matched to the subject motion",
      ],
      seed,
      3,
    );
  }
  return pick(analysis.arabic ? setting.lineAr : setting.lineEn, seed, 4);
}

function cameraLine(analysis: SceneAnalysis, seed: number, video: boolean): string {
  if (!video) {
    return analysis.arabic
      ? pick(
          [
            "تكوين سينمائي واضح مع عزل نظيف للموضوع وعمق ميداني مناسب",
            "إطار بطولي متوازن وتفاصيل حادة في الوجه والجسم",
          ],
          seed,
          5,
        )
      : pick(
          [
            "clear cinematic framing with clean subject isolation and fitting depth of field",
            "balanced hero frame with sharp face and body detail",
          ],
          seed,
          5,
        );
  }

  if (analysis.motion === "intense") {
    return analysis.arabic
      ? pick(
          [
            "كاميرا تتبّع ديناميكية تحافظ على ثبات الموضوع رغم السرعة",
            "حركة كاميرا سينمائية سريعة مع استقرار على الوجه والجسم",
          ],
          seed,
          5,
        )
      : pick(
          [
            "dynamic tracking camera locked on the subject despite speed",
            "fast cinematic camera move with stable face and body framing",
          ],
          seed,
          5,
        );
  }

  if (analysis.motion === "gentle" || analysis.motion === "still") {
    return analysis.arabic
      ? pick(
          [
            "كاميرا تتبّع سلسة ومنخفضة الاهتزاز ترافق الحركة بهدوء",
            "دفعة كاميرا ناعمة للأمام مع تركيز ثابت على التعبير",
          ],
          seed,
          5,
        )
      : pick(
          [
            "smooth low-shake tracking camera gently following the motion",
            "soft cinematic push-in with stable focus on expression",
          ],
          seed,
          5,
        );
  }

  return analysis.arabic
    ? "كاميرا سينمائية سلسة بإيقاع يناسب حركة المشهد"
    : "smooth cinematic camera pacing matched to the scene motion";
}

function lightLine(analysis: SceneAnalysis, seed: number): string {
  if (analysis.settingKey === "night" || analysis.moodKey === "dark") {
    return analysis.arabic
      ? pick(
          [
            "إضاءة ليلية سينمائية مع تباين درامي ولمعات دقيقة",
            "ضوء محيطي خافت وظلال عميقة تعزّز الدراما",
          ],
          seed,
          6,
        )
      : pick(
          [
            "cinematic night lighting with dramatic contrast and tiny highlights",
            "soft ambient light and deep shadows that heighten drama",
          ],
          seed,
          6,
        );
  }
  if (analysis.settingKey === "beach" || analysis.settingKey === "desert") {
    return analysis.arabic
      ? "إضاءة طبيعية سينمائية دافئة مع تدرّج ألوان غني وتفاصيل حادة"
      : "warm natural cinematic light with rich color grade and sharp detail";
  }
  if (analysis.settingKey === "studio") {
    return analysis.arabic
      ? "إضاءة استوديو احترافية ناعمة مع فصل نظيف للخلفية"
      : "soft professional studio lighting with clean background separation";
  }
  return analysis.arabic
    ? pick(
        [
          "إضاءة طبيعية سينمائية وتدرّج ألوان غني وتفاصيل حادة",
          "إضاءة واقعية متوازنة مع لمسات حجمية خفيفة",
        ],
        seed,
        6,
      )
    : pick(
        [
          "natural cinematic lighting, rich color grade, sharp detail",
          "balanced realistic light with soft volumetric accents",
        ],
        seed,
        6,
      );
}

function moodLine(analysis: SceneAnalysis): string | null {
  const mood = MOOD_RULES.find((r) => r.key === analysis.moodKey);
  if (!mood) return null;
  return analysis.arabic ? mood.lineAr : mood.lineEn;
}

function qualityCloser(analysis: SceneAnalysis, video: boolean): string {
  if (analysis.arabic) {
    return video
      ? "مشهد سينمائي واقعي، حركة متّسقة زمنياً، بدون تشويش أو عناصر عشوائية"
      : "جودة فوتورياليستية احترافية، تفاصيل نظيفة، بدون تشويش أو عناصر عشوائية";
  }
  return video
    ? "cinematic realistic scene, temporally consistent motion, no flicker or random artifacts"
    : "photorealistic professional quality, clean detail, no noise or random artifacts";
}

function buildArabicVideo(analysis: SceneAnalysis, seed: number): string {
  const parts = [
    `مشهد سينمائي واقعي: ${analysis.idea}`,
    ...secondaryLines(analysis, seed),
    settingLine(analysis, seed),
    cameraLine(analysis, seed, true),
    lightLine(analysis, seed),
    moodLine(analysis),
    qualityCloser(analysis, true),
  ].filter(Boolean) as string[];
  return parts.join(". ") + ".";
}

function buildArabicImage(analysis: SceneAnalysis, seed: number): string {
  const parts = [
    `صورة سينمائية واقعية: ${analysis.idea}`,
    ...secondaryLines(analysis, seed),
    settingLine(analysis, seed),
    cameraLine(analysis, seed, false),
    lightLine(analysis, seed),
    moodLine(analysis),
    qualityCloser(analysis, false),
  ].filter(Boolean) as string[];
  return parts.join(". ") + ".";
}

function buildEnglishVideo(analysis: SceneAnalysis, seed: number): string {
  const parts = [
    `Cinematic realistic scene: ${analysis.idea}`,
    ...secondaryLines(analysis, seed),
    settingLine(analysis, seed),
    cameraLine(analysis, seed, true),
    lightLine(analysis, seed),
    moodLine(analysis),
    qualityCloser(analysis, true),
  ].filter(Boolean) as string[];
  return parts.join(", ") + ".";
}

function buildEnglishImage(analysis: SceneAnalysis, seed: number): string {
  const parts = [
    `Cinematic realistic image: ${analysis.idea}`,
    ...secondaryLines(analysis, seed),
    settingLine(analysis, seed),
    cameraLine(analysis, seed, false),
    lightLine(analysis, seed),
    moodLine(analysis),
    qualityCloser(analysis, false),
  ].filter(Boolean) as string[];
  return parts.join(", ") + ".";
}

/**
 * Returns a complete replacement prompt built from the user's core idea.
 */
export function enhancePrompt(prompt: string, mode: string): string {
  const idea = extractCoreIdea(prompt);
  if (!idea) return "";

  const analysis = analyzeScene(idea);
  const seed = hashSeed(idea + mode);
  const video = mode.includes("video");

  if (analysis.arabic) {
    return video ? buildArabicVideo(analysis, seed) : buildArabicImage(analysis, seed);
  }
  return video ? buildEnglishVideo(analysis, seed) : buildEnglishImage(analysis, seed);
}

export function enhancePromptVariant(prompt: string, mode: string, emphasis: string): string {
  const idea = extractCoreIdea(prompt);
  if (!idea) return "";
  const arabic = isArabic(idea);
  const emphasisLine = arabic
    ? /mood|texture/i.test(emphasis)
      ? "مع تركيز أقوى على المزاج والملمس البصري"
      : /motion|action/i.test(emphasis)
        ? "مع تركيز أقوى على فيزياء الحركة والتفاصيل الثانوية"
        : emphasis
    : emphasis;
  return enhancePrompt(`${idea}. ${emphasisLine}`, mode);
}

export type EnhanceContext = {
  imageUrls?: string[];
  previousState?: SceneState | null;
  /** When true, treat as continuation even without ثم/then if previousState exists */
  forceChain?: boolean;
};

export type EnhanceWithContextResult = {
  enhanced: string;
  finalState: SceneState;
  visionUsed: boolean;
  /** True when images were provided but no vision provider returned entities */
  needsVisionKey: boolean;
  chained: boolean;
  entityBrief: string;
  coreIdea: string;
};

/**
 * Full enhance pipeline with optional vision entity injection + state chaining.
 */
export async function enhancePromptWithContext(
  prompt: string,
  mode: string,
  context: EnhanceContext = {},
): Promise<EnhanceWithContextResult> {
  const rawIdea = extractCoreIdea(prompt);
  if (!rawIdea) {
    return {
      enhanced: "",
      finalState: buildSceneState({
        action: "",
        enhanced: "",
        entityPhrases: [],
        previous: context.previousState,
      }),
      visionUsed: false,
      needsVisionKey: false,
      chained: false,
      entityBrief: "",
      coreIdea: "",
    };
  }

  const imageUrls = (context.imageUrls || []).filter(Boolean);
  let vision: VisionSceneBrief | null = null;
  if (imageUrls.length) {
    vision = await analyzeReferenceImages(imageUrls, rawIdea);
  }

  const arabic =
    isArabic(rawIdea) ||
    Boolean(context.previousState?.arabic) ||
    Boolean(vision?.arabicPreferred);

  const fromVision = entityPhrasesFromBrief(vision);
  let entities = fromVision.phrases;
  let genders = fromVision.genders;

  // Reuse prior concrete entities for sequential shots (same cast).
  if (!entities.length && context.previousState?.entities?.length) {
    const prev = context.previousState.entities;
    const looksConcrete = prev.every(
      (p) => p && !/الصورة المرجعية|reference image|الشخصية الظاهرة/i.test(p),
    );
    if (looksConcrete) {
      entities = prev;
      genders =
        context.previousState.entityGenders ||
        prev.map(() => "unknown" as const);
    }
  }

  const visionUsed = Boolean(vision && vision.source !== "none" && entities.length);
  const needsVisionKey = Boolean(imageUrls.length) && !visionUsed;

  const previous = context.previousState || null;

  // Only inject concrete appearance phrases when vision (or prior concrete state) exists.
  // Never inject vague "الشخصية الظاهرة في الصورة..." placeholders — they corrupt Arabic.
  const chainedBuild = buildChainedIdea({
    action: rawIdea,
    previous,
    entityPhrases: visionUsed || entities.length ? entities : [],
    entityGenders: genders,
    forceChain: context.forceChain,
  });

  let groundedIdea = chainedBuild.idea;
  if (visionUsed && vision?.setting) {
    groundedIdea = arabic
      ? `${groundedIdea}. المكان كما في الصورة: ${vision.setting}`
      : `${groundedIdea}. Setting matches the reference image: ${vision.setting}`;
  }
  if (visionUsed) {
    groundedIdea = arabic
      ? `${groundedIdea}. حافظ على نفس الملابس والألوان والأطوال المستخرجة من الصورة.`
      : `${groundedIdea}. Keep the exact clothing, colors, and heights extracted from the reference image.`;
  } else if (needsVisionKey) {
    // Do not invent clothing. Keep user's nouns; ask ops to enable vision.
    groundedIdea = arabic
      ? `${rawIdea}. (مطلوب تحليل الصورة لاستبدال الأنثى/الرجل بمواصفات الملابس والطول من الصورة — أضف OPENAI_API_KEY أو GEMINI_API_KEY)`
      : `${rawIdea}. (Vision key required to replace man/woman with clothing/height from the image — set OPENAI_API_KEY or GEMINI_API_KEY)`;
  }

  const enhanced = enhancePrompt(groundedIdea, mode);
  const finalState = buildSceneState({
    action: rawIdea,
    enhanced,
    entityPhrases: entities,
    entityGenders: genders,
    setting: vision?.setting || previous?.setting,
    previous,
  });

  return {
    enhanced,
    finalState,
    visionUsed,
    needsVisionKey,
    chained: chainedBuild.chained,
    entityBrief: formatEntityBrief(vision, arabic),
    coreIdea: groundedIdea,
  };
}

export type { SceneState };
