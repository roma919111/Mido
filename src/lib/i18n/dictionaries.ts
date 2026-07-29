/**
 * Veronix UI locales — Arabic (default) + English.
 * Cookie: veronix_locale=ar|en
 */

export type Locale = "ar" | "en";

export const LOCALES: Locale[] = ["ar", "en"];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "veronix_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeDir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export type Dictionary = {
  meta: {
    titleDefault: string;
    titleTemplate: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    twitterDescription: string;
    homeH1: string;
    homeSeoP: string;
    homeBullets: string[];
  };
  nav: {
    home: string;
    inspire: string;
    create: string;
    tools: string;
    assets: string;
    createPick: string;
    createVideo: string;
    createImage: string;
    createVideoHint: string;
    createImageHint: string;
  };
  header: {
    upgrade: string;
    login: string;
    signup: string;
    logout: string;
    admin: string;
    account: string;
  };
  home: {
    brandEyebrow: string;
    brandTitle: string;
    heroLine: string;
    freeTrial: string;
    ctaCreate: string;
    ctaPricing: string;
    studioEyebrow: string;
    studioTitle: string;
    studioSub: string;
  };
  footer: {
    blurb: string;
    about: string;
    faq: string;
    contact: string;
    privacy: string;
    terms: string;
    pricing: string;
    rights: string;
    backHome: string;
  };
  auth: {
    loginTitle: string;
    signupTitle: string;
    loginSub: string;
    signupSub: string;
    email: string;
    password: string;
    name: string;
    submitLogin: string;
    submitSignup: string;
    orGoogle: string;
    noAccount: string;
    hasAccount: string;
    paywallHint: string;
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    plans: string;
    topups: string;
    current: string;
    upgradeTo: string;
    switchTo: string;
    addCredits: string;
    freeTrialNote: string;
    stripeMissing: string;
  };
  about: {
    title: string;
    p1: string;
    p2: string;
    featuresTitle: string;
    features: string[];
    contactTitle: string;
  };
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  contact: {
    title: string;
    p1: string;
    emailLabel: string;
    siteLabel: string;
  };
  privacy: {
    title: string;
    body: string[];
  };
  terms: {
    title: string;
    body: string[];
  };
  create: {
    videoTitle: string;
    videoSub: string;
    imageTitle: string;
    imageSub: string;
    model: string;
    characters: string;
    charactersOptional: string;
    charactersHint: string;
    characterName: string;
    characterNamePlaceholder: string;
    enhance: string;
    enhancing: string;
    generate: string;
    freeGenerate: string;
    duration: string;
    aspect: string;
    clarity: string;
    clarityFree: string;
    audio: string;
    promptVideo: string;
    promptImage: string;
    mediaImage: string;
    mediaVideo: string;
    add: string;
    imageBroken: string;
    reupload: string;
    studioVideo: string;
    studioImage: string;
    modelsVideoOnly: string;
    modelsImageOnly: string;
    comingSoon: string;
    createdBy: string;
    freeTrialBanner: string;
    outputCount: string;
    native720Note: string;
    clarityUpgrade: string;
  };
  assets: {
    video: string;
    photos: string;
    browse: string;
    grid: string;
    play: string;
    pause: string;
    edit: string;
    delete: string;
    download: string;
    showMore: string;
    showLess: string;
    noPrompt: string;
    swipeUp: string;
    gridHint: string;
    generating: string;
    failed: string;
    failedRefunded: string;
    creditReturned: string;
    withAudio: string;
    noAudio: string;
    clarityMark: string;
    mute: string;
    unmute: string;
    zoom: string;
  };
  lang: {
    ar: string;
    en: string;
    switchTo: string;
  };
};

export const ar: Dictionary = {
  meta: {
    titleDefault: "Veronix.ai — استوديو الصور والفيديو بالذكاء الاصطناعي",
    titleTemplate: "%s · Veronix.ai",
    description:
      "أنشئ صورًا وفيديوهات بالذكاء الاصطناعي على Veronix.ai. أول فيديو مجاني، محفظة كريدت، باقات شهرية، ودفع آمن عبر Stripe على vyronix.app.",
    ogTitle: "Veronix.ai — استوديو الصور والفيديو",
    ogDescription:
      "منصة لتوليد الصور والفيديو بالذكاء الاصطناعي — تجربة مجانية + باقات على vyronix.app",
    twitterDescription: "استوديو AI للصور والفيديو — أول فيديو مجاني على vyronix.app",
    homeH1: "Veronix.ai — استوديو الصور والفيديو بالذكاء الاصطناعي",
    homeSeoP:
      "Veronix.ai منصة رسمية على vyronix.app لتوليد الصور والفيديو بالذكاء الاصطناعي. سجّل حسابك، جرّب أول فيديو مجانًا، واختر الباقة المناسبة.",
    homeBullets: [
      "أول فيديو Veronix مجاني مرة واحدة",
      "توليد صور وفيديو 480p / 720p",
      "محفظة كريدت وباقات شهرية",
      "واجهة عربية وإنجليزية",
    ],
  },
  nav: {
    home: "الرئيسية",
    inspire: "إلهام",
    create: "إنشاء",
    tools: "أدوات",
    assets: "أصولي",
    createPick: "اختر النوع للمتابعة",
    createVideo: "فيديو VYRONIX",
    createImage: "صور VYRONIX",
    createVideoHint: "4–15 ثانية · 480p / 720p",
    createImageHint: "جودة 2K · بدون واترمارك",
  },
  header: {
    upgrade: "ترقية",
    login: "دخول",
    signup: "حساب",
    logout: "خروج",
    admin: "Admin",
    account: "حسابي",
  },
  home: {
    brandEyebrow: "Veronix.ai",
    brandTitle: "Veronix",
    heroLine: "حوّل فكرتك إلى فيديو وصورة بالذكاء الاصطناعي خلال دقائق.",
    freeTrial: "أول فيديو مجاني مرة واحدة — سجّل وابدأ الآن",
    ctaCreate: "ابدأ الإنشاء",
    ctaPricing: "الباقات والأسعار",
    studioEyebrow: "إنشاء",
    studioTitle: "استوديو الصور والفيديو",
    studioSub: "اختر صورة أو فيديو، ثم الموديل، واكتب وصفك.",
  },
  footer: {
    blurb:
      "منصة Veronix.ai لتوليد الصور والفيديو بالذكاء الاصطناعي — حسابات زبائن، محفظة كريدت، ودفع آمن عبر Stripe.",
    about: "عن Veronix",
    faq: "الأسئلة الشائعة",
    contact: "تواصل معنا",
    privacy: "الخصوصية",
    terms: "الشروط",
    pricing: "الباقات",
    rights: "جميع الحقوق محفوظة.",
    backHome: "العودة للرئيسية",
  },
  auth: {
    loginTitle: "تسجيل الدخول",
    signupTitle: "إنشاء حساب",
    loginSub: "ادخل لحسابك لمتابعة التوليد وإدارة الكريدت.",
    signupSub: "أنشئ حسابك وابدأ بأول فيديو مجاني على Veronix.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    name: "الاسم",
    submitLogin: "دخول",
    submitSignup: "إنشاء الحساب",
    orGoogle: "أو المتابعة مع Google",
    noAccount: "ليس لديك حساب؟",
    hasAccount: "لديك حساب؟",
    paywallHint: "أكمل التسجيل ثم اختر باقة أو شحن كريدت للمتابعة.",
  },
  pricing: {
    eyebrow: "التسعير",
    title: "الباقات والشحن",
    subtitle: "اختر باقة شهرية أو اشحن الكريدت عند الحاجة — الدفع عبر Stripe.",
    plans: "الباقات الشهرية",
    topups: "شحن الكريدت",
    current: "باقتك الحالية",
    upgradeTo: "الترقية إلى",
    switchTo: "التحويل إلى",
    addCredits: "أضف الكريدت الآن",
    freeTrialNote: "أول فيديو Veronix مجاني مرة واحدة للحسابات بدون رصيد.",
    stripeMissing: "الدفع غير مفعّل مؤقتًا — تواصل مع الدعم.",
  },
  about: {
    title: "عن Veronix.ai",
    p1: "Veronix.ai استوديو لتوليد الصور والفيديو بالذكاء الاصطناعي على الدومين الرسمي https://vyronix.app.",
    p2: "نقدّم حسابات زبائن، محفظة كريدت، باقات شهرية، وتجربة إنشاء مباشرة من المتصفح — مع دفع آمن عبر Stripe وتسجيل اختياري عبر Google.",
    featuresTitle: "ما يميزنا",
    features: [
      "واجهة عربية وإنجليزية لإنشاء الصور والفيديو.",
      "تسعير بالكريدت شفاف قبل التوليد.",
      "تجربة مجانية محدودة لأول فيديو Veronix وفق الشروط المعروضة.",
      "استضافة إنتاج دائمة على بنية تحتية سحابية مع نطاق مخصص.",
    ],
    contactTitle: "التواصل الرسمي",
  },
  faq: {
    title: "الأسئلة الشائعة",
    items: [
      {
        q: "هل يوجد فيديو مجاني؟",
        a: "نعم — أول فيديو Veronix مجاني مرة واحدة للحسابات بدون رصيد، وفق الشروط المعروضة في الاستوديو.",
      },
      {
        q: "ما وضوح الفيديو المتاح؟",
        a: "480p و720p. يمكن تفعيل ترقية وضوح مجانية من 480 إلى نحو 720 عند الرغبة.",
      },
      {
        q: "كيف أدفع؟",
        a: "عبر Stripe بأمان: باقات شهرية أو شحن كريدت. يظهر الرصيد بعد تأكيد الدفع.",
      },
      {
        q: "هل تدعمون العربية والإنجليزية؟",
        a: "نعم — واجهة الموقع باللغتين، ويمكنك كتابة وصف المشهد بالعربية أو الإنجليزية.",
      },
    ],
  },
  contact: {
    title: "تواصل معنا",
    p1: "للدعم الفني والاشتراكات والاستفسارات التجارية راسلنا على البريد الرسمي.",
    emailLabel: "البريد",
    siteLabel: "الموقع",
  },
  privacy: {
    title: "سياسة الخصوصية",
    body: [
      "نجمع بيانات الحساب الأساسية (مثل البريد) لتشغيل الخدمة والمدفوعات.",
      "وسائط التوليد تُحفظ لحسابك في Assets ويمكنك حذفها.",
      "لا نبيع بياناتك الشخصية لأطراف ثالثة لأغراض إعلانية.",
      "للطلبات المتعلقة بالخصوصية: support@vyronix.app",
    ],
  },
  terms: {
    title: "شروط الاستخدام",
    body: [
      "باستخدامك Veronix.ai فإنك توافق على الاستخدام المشروع للمحتوى الذي تنشئه.",
      "الكريدت والباقات تُحتسب وفق التسعير الظاهر قبل التوليد.",
      "التجربة المجانية محدودة مرة واحدة لكل حساب وفق الشروط المعروضة.",
      "يحق لنا إيقاف الحسابات التي تنتهك السياسات أو تسيء استخدام المنصة.",
    ],
  },
  create: {
    videoTitle: "إنشاء فيديو",
    videoSub: "موديل VYRONIX للفيديو — اكتب وصف المشهد والحركة.",
    imageTitle: "إنشاء صورة",
    imageSub: "موديل VYRONIX للصور — اكتب وصف الصورة. بدون واترمارك.",
    model: "الموديل",
    characters: "رفع الشخصيات",
    charactersOptional: "(اختياري)",
    charactersHint:
      "سمِّ كل شخصية ثم اذكر اسمها في الوصف مباشرة — مثل «محمد ذهب إلى الحديقة» بدون @.",
    characterName: "اسم الشخصية",
    characterNamePlaceholder: "مثال: محمد",
    enhance: "تحسين الوصف",
    enhancing: "جاري التحسين…",
    generate: "Generate",
    freeGenerate: "Generate مجاني",
    duration: "المدة",
    aspect: "النسبة",
    clarity: "الوضوح",
    clarityFree: "مجاني",
    audio: "توليد صوت",
    promptVideo: "صف مشهد الفيديو والحركة…",
    promptImage: "صف الصورة بالتفصيل…",
    mediaImage: "صورة",
    mediaVideo: "فيديو",
    add: "إضافة",
    imageBroken: "الصورة لا تظهر",
    reupload: "أعد رفعها",
    studioVideo: "استوديو الفيديو",
    studioImage: "استوديو الصور",
    modelsVideoOnly: "موديلات الفيديو فقط",
    modelsImageOnly: "موديلات الصور فقط",
    comingSoon: "قريبًا",
    createdBy: "تم إنشاؤه بواسطة VYRONIX",
    freeTrialBanner:
      "أول فيديو على Veronix مجاني مرة واحدة — مقدمة Veronix + 4 ثوانٍ · 480p.",
    outputCount: "عدد الفيديوهات",
    native720Note: "720p أصلي — لا حاجة لترقية وضوح إضافية",
    clarityUpgrade: "ترقية وضوح 480→720",
  },
  assets: {
    video: "فيديو",
    photos: "صور",
    browse: "تصفح",
    grid: "فرز",
    play: "تشغيل",
    pause: "إيقاف",
    edit: "تعديل",
    delete: "حذف",
    download: "تحميل",
    showMore: "عرض المزيد",
    showLess: "عرض أقل",
    noPrompt: "بدون وصف",
    swipeUp: "اسحب للأعلى",
    gridHint: "شبكة الفيديوهات",
    generating: "جاري التوليد",
    failed: "فشل التوليد",
    failedRefunded: "فشل التوليد · تم استرجاع الكريديت",
    creditReturned: "أُعيد الكريديت إلى رصيدك",
    withAudio: "بصوت",
    noAudio: "بدون صوت",
    clarityMark: "وضوح",
    mute: "كتم الصوت",
    unmute: "تشغيل الصوت",
    zoom: "زوم الشبكة",
  },
  lang: {
    ar: "العربية",
    en: "English",
    switchTo: "اللغة",
  },
};

export const en: Dictionary = {
  meta: {
    titleDefault: "Veronix.ai — AI Image & Video Studio",
    titleTemplate: "%s · Veronix.ai",
    description:
      "Create AI images and videos on Veronix.ai. Free first video, credit wallet, monthly plans, and secure Stripe checkout on vyronix.app.",
    ogTitle: "Veronix.ai — AI Image & Video Studio",
    ogDescription:
      "Generate AI images and videos — free starter trial + paid plans on vyronix.app",
    twitterDescription: "AI image & video studio — free first video on vyronix.app",
    homeH1: "Veronix.ai — AI Image & Video Studio",
    homeSeoP:
      "Veronix.ai is the official studio on vyronix.app for AI image and video generation. Sign up, try your first free video, and pick a plan that fits.",
    homeBullets: [
      "One free Veronix video per new empty wallet",
      "Image & video at 480p / 720p",
      "Credit wallet and monthly plans",
      "Arabic and English interface",
    ],
  },
  nav: {
    home: "Home",
    inspire: "Inspire",
    create: "Create",
    tools: "Tools",
    assets: "Assets",
    createPick: "Choose a type to continue",
    createVideo: "VYRONIX Video",
    createImage: "VYRONIX Image",
    createVideoHint: "4–15s · 480p / 720p",
    createImageHint: "2K quality · no watermark",
  },
  header: {
    upgrade: "Upgrade",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    admin: "Admin",
    account: "Account",
  },
  home: {
    brandEyebrow: "Veronix.ai",
    brandTitle: "Veronix",
    heroLine: "Turn your idea into AI video and images in minutes.",
    freeTrial: "First video free once — sign up and start now",
    ctaCreate: "Start creating",
    ctaPricing: "Plans & pricing",
    studioEyebrow: "Create",
    studioTitle: "Image & video studio",
    studioSub: "Pick image or video, choose a model, then write your prompt.",
  },
  footer: {
    blurb:
      "Veronix.ai generates AI images and videos — customer accounts, credit wallet, and secure Stripe payments.",
    about: "About",
    faq: "FAQ",
    contact: "Contact",
    privacy: "Privacy",
    terms: "Terms",
    pricing: "Pricing",
    rights: "All rights reserved.",
    backHome: "Back to home",
  },
  auth: {
    loginTitle: "Log in",
    signupTitle: "Create account",
    loginSub: "Sign in to keep generating and manage your credits.",
    signupSub: "Create your account and start with a free Veronix video.",
    email: "Email",
    password: "Password",
    name: "Name",
    submitLogin: "Log in",
    submitSignup: "Create account",
    orGoogle: "Or continue with Google",
    noAccount: "No account?",
    hasAccount: "Already have an account?",
    paywallHint: "Finish signup, then choose a plan or top-up to continue.",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Plans & top-ups",
    subtitle: "Pick a monthly plan or top up credits anytime — checkout via Stripe.",
    plans: "Monthly plans",
    topups: "Credit top-ups",
    current: "Current plan",
    upgradeTo: "Upgrade to",
    switchTo: "Switch to",
    addCredits: "Add credits now",
    freeTrialNote: "First Veronix video is free once for empty wallets.",
    stripeMissing: "Checkout is temporarily unavailable — contact support.",
  },
  about: {
    title: "About Veronix.ai",
    p1: "Veronix.ai is an AI image and video studio on the official domain https://vyronix.app.",
    p2: "We offer customer accounts, a credit wallet, monthly plans, and in-browser creation — with secure Stripe payments and optional Google sign-in.",
    featuresTitle: "What we offer",
    features: [
      "Arabic and English UI for images and video.",
      "Transparent credit pricing before you generate.",
      "Limited free first Veronix video under the shown terms.",
      "Production hosting on cloud infrastructure with a custom domain.",
    ],
    contactTitle: "Official contact",
  },
  faq: {
    title: "FAQ",
    items: [
      {
        q: "Is there a free video?",
        a: "Yes — one free Veronix video for empty wallets, under the terms shown in the studio.",
      },
      {
        q: "What video resolutions are available?",
        a: "480p and 720p. You can also opt into a free clarity upgrade from 480 toward ~720.",
      },
      {
        q: "How do I pay?",
        a: "Securely via Stripe: monthly plans or credit top-ups. Credits appear after payment confirmation.",
      },
      {
        q: "Do you support Arabic and English?",
        a: "Yes — the site UI is bilingual, and you can write prompts in Arabic or English.",
      },
    ],
  },
  contact: {
    title: "Contact us",
    p1: "For support, billing, and business questions, email our official address.",
    emailLabel: "Email",
    siteLabel: "Website",
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "We collect basic account data (such as email) to run the service and payments.",
      "Generated media is stored in your Assets library and can be deleted by you.",
      "We do not sell your personal data to third parties for advertising.",
      "Privacy requests: support@vyronix.app",
    ],
  },
  terms: {
    title: "Terms of use",
    body: [
      "By using Veronix.ai you agree to create and use content lawfully.",
      "Credits and plans are billed according to the price shown before generation.",
      "The free trial is limited to once per account under the shown terms.",
      "We may suspend accounts that violate policies or abuse the platform.",
    ],
  },
  create: {
    videoTitle: "Create video",
    videoSub: "VYRONIX video model — describe the scene and motion.",
    imageTitle: "Create image",
    imageSub: "VYRONIX image model — describe the image. No watermark.",
    model: "Model",
    characters: "Upload characters",
    charactersOptional: "(optional)",
    charactersHint:
      "Name each character, then mention the name in your prompt — e.g. “Sara walked to the park” (no @ needed).",
    characterName: "Character name",
    characterNamePlaceholder: "e.g. Sara",
    enhance: "Enhance prompt",
    enhancing: "Enhancing…",
    generate: "Generate",
    freeGenerate: "Free Generate",
    duration: "Duration",
    aspect: "Aspect",
    clarity: "Clarity",
    clarityFree: "Free",
    audio: "Generate audio",
    promptVideo: "Describe the video scene and motion…",
    promptImage: "Describe the image in detail…",
    mediaImage: "Image",
    mediaVideo: "Video",
    add: "Add",
    imageBroken: "Image won’t load",
    reupload: "Upload again",
    studioVideo: "Video studio",
    studioImage: "Image studio",
    modelsVideoOnly: "Video models only",
    modelsImageOnly: "Image models only",
    comingSoon: "Coming soon",
    createdBy: "Created by VYRONIX",
    freeTrialBanner:
      "Your first Veronix video is free once — Veronix intro + 4s · 480p.",
    outputCount: "Video count",
    native720Note: "Native 720p — no extra clarity upgrade needed",
    clarityUpgrade: "Clarity upgrade 480→720",
  },
  assets: {
    video: "Video",
    photos: "Photos",
    browse: "Browse",
    grid: "Grid",
    play: "Play",
    pause: "Pause",
    edit: "Edit",
    delete: "Delete",
    download: "Download",
    showMore: "Show more",
    showLess: "Show less",
    noPrompt: "No description",
    swipeUp: "Swipe up",
    gridHint: "Video grid",
    generating: "Generating",
    failed: "Generation failed",
    failedRefunded: "Generation failed · credits refunded",
    creditReturned: "Credits were returned to your balance",
    withAudio: "With audio",
    noAudio: "No audio",
    clarityMark: "clarity",
    mute: "Mute",
    unmute: "Unmute",
    zoom: "Grid zoom",
  },
  lang: {
    ar: "العربية",
    en: "English",
    switchTo: "Language",
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : ar;
}
