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
    directors: string;
    editing: string;
    create: string;
    tools: string;
    assets: string;
    createPick: string;
    createVideo: string;
    createImage: string;
    createVideoHint: string;
    createImageHint: string;
    modelsStrip: string;
    invite: string;
  };
  header: {
    mainNav: string;
    upgrade: string;
    login: string;
    signup: string;
    logout: string;
    admin: string;
    account: string;
  };
  settings: {
    eyebrow: string;
    title: string;
    subtitle: string;
    profileTab: string;
    billingTab: string;
    avatarTitle: string;
    avatarHint: string;
    changeAvatar: string;
    avatarSaved: string;
    avatarError: string;
    nameTitle: string;
    nameHint: string;
    namePlaceholder: string;
    saveName: string;
    nameSaved: string;
    nameError: string;
    planTitle: string;
    paidPlan: string;
    freePlan: string;
    creditsBalance: string;
    monthlyCredits: string;
    renewsOn: string;
    endsOn: string;
    status: string;
    manageTitle: string;
    manageHint: string;
    changePlan: string;
    stripePortal: string;
    cancelSubscription: string;
    cancelConfirm: string;
    cancelDone: string;
    cancelError: string;
    portalError: string;
    billingLoading: string;
    loginRequired: string;
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
    feedEyebrow: string;
    feedTitle: string;
    feedSub: string;
    feedLoading: string;
  };
  storage: {
    eyebrow: string;
    title: string;
    titleCritical: string;
    body: string;
    videosAvailable: string;
    connectDrive: string;
    uploadToDrive: string;
    deleteMyself: string;
    later: string;
    driveHint: string;
    uploading: string;
    uploadDone: string;
    uploadFailed: string;
    needDrive: string;
  };
  footer: {
    blurb: string;
    about: string;
    faq: string;
    contact: string;
    privacy: string;
    terms: string;
    pricing: string;
    models: string;
    rights: string;
    backHome: string;
    followUs: string;
    socialTiktok: string;
    socialYoutube: string;
    socialInstagram: string;
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
  seoPages: {
    pricingDescription: string;
    faqDescription: string;
    toolsDescription: string;
    editTitle: string;
    editDescription: string;
  };
  seoLandings: {
    aiVideo: string;
    aiImage: string;
    textToVideo: string;
    aiEditor: string;
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
    characterIdentityTitle: string;
    characterIdentityNote: string;
    characterStepUpload: string;
    characterStepName: string;
    characterStepPrompt: string;
    characterStepSameSettings: string;
    characterStepFromGeneration: string;
    characterFromGenerationLoaded: string;
    characterIdentityLinked: string;
    characterIdentityUnlinked: string;
    sceneSequenceTitle: string;
    resetSequence: string;
    resetSequenceHint: string;
    resetSequenceIdle: string;
    resetSequenceActive: string;
    resetSequenceDone: string;
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
    resultPreview: string;
    resultVideos: string;
    resultImages: string;
    resultAll: string;
    resultReady: string;
    resultShare: string;
    resultEmpty: string;
  };
  assets: {
    video: string;
    photos: string;
    browse: string;
    grid: string;
    play: string;
    pause: string;
    edit: string;
    continueCharacter: string;
    continueCharacterHint: string;
    sendToStudio: string;
    sentToStudio: string;
    selectedCount: string;
    clearSelection: string;
    delete: string;
    download: string;
    showMore: string;
    showLess: string;
    promptLabel: string;
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
  models: {
    eyebrow: string;
    title: string;
    subtitle: string;
    videoTitle: string;
    videoSub: string;
    imageTitle: string;
    imageSub: string;
    available: string;
    soon: string;
    video: string;
    image: string;
    footerNote: string;
    detailAbout: string;
    detailVideoBody: string;
    detailImageBody: string;
    detailAvailable: string;
    detailSoon: string;
    detailCta: string;
  };
  inspire: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tabList: string;
    tabTrending: string;
    tabMovies: string;
    tabSeries: string;
    tabAll: string;
    allGenres: string;
    searchPlaceholder: string;
    refresh: string;
    movie: string;
    series: string;
    trendingBadge: string;
    usePrompt: string;
    empty: string;
    loading: string;
    error: string;
    promptLabel: string;
    createCta: string;
    copyPrompt: string;
    copied: string;
    close: string;
    tmdbNote: string;
    genres: Record<
      "action" | "drama" | "sci-fi" | "horror" | "comedy" | "romance" | "thriller" | "fantasy" | "animation" | "crime",
      string
    >;
  };
  directors: {
    eyebrow: string;
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    usePrompt: string;
    empty: string;
    promptLabel: string;
    createCta: string;
    copyPrompt: string;
    copied: string;
    close: string;
  };
  invite: {
    eyebrow: string;
    title: string;
    subtitle: string;
    loginRequired: string;
    loading: string;
    rewardTitle: string;
    rewardYou: string;
    rewardFriend: string;
    yourLink: string;
    copy: string;
    share: string;
    copied: string;
    copyFailed: string;
    shared: string;
    shareFailed: string;
  };
  editStudio: {
    tab: string;
    tabList: string;
    title: string;
    subtitle: string;
    trim: string;
    trimStart: string;
    trimEnd: string;
    trimLock: string;
    aspect: string;
    filters: string;
    filterNone: string;
    filterCinematic: string;
    filterVintage: string;
    filterContrast: string;
    filterBw: string;
    export: string;
    exporting: string;
    exportServerProcessing: string;
    exportDone: string;
    exportDoneNewTab: string;
    exportFailed: string;
    exportAudioFailed: string;
    exportMemoryFailed: string;
    clear: string;
    noVideo: string;
    noVideoHint: string;
    clientNote: string;
    timeline: string;
    clipCount: string;
    moveBack: string;
    moveForward: string;
    deleteClip: string;
    mergeExport: string;
    exportActiveClip: string;
    exportQuality: string;
    exportQualityStandard: string;
    exportQualityHigh: string;
    exportQualityStandardHint: string;
    exportQualityHighHint: string;
    publishToHome: string;
    publishing: string;
    publishDone: string;
    publishFailed: string;
    publishedToHome: string;
    viewOnHome: string;
    clearAll: string;
    transition: string;
    transitionNone: string;
    transitionFade: string;
    transitionDissolve: string;
    transitionWipe: string;
    subtitlesTitle: string;
    manualDialogueHint: string;
    addDialogueLine: string;
    addDialogueAtPlayhead: string;
    dialogueStartTime: string;
    dialogueEndTime: string;
    deleteDialogueLine: string;
    extractAllHint: string;
    manualDialogueLabel: string;
    setStartToPlayhead: string;
    setEndToPlayhead: string;
    dialogueSpeakerOptional: string;
    charactersOptionalLabel: string;
    subtitleClock: string;
    subtitleWaiting: string;
    dialoguePlaceholder: string;
    dialogueSpeaker: string;
    dialogueLinesEmpty: string;
    charactersTitle: string;
    characterNamePlaceholder: string;
    addCharacter: string;
    deleteCharacter: string;
    charactersHint: string;
    characterExists: string;
    selectCharacterFirst: string;
    extractCharacterDialogue: string;
    extractCharacterDialoguePick: string;
    extractAllSpeech: string;
    extractAllSpeechDone: string;
    extractFallback: string;
    extractAllCharacters: string;
    extractDoneForCharacter: string;
    extractAllDone: string;
    noDialogueForCharacter: string;
    noDialogueInClip: string;
    translateToArabic: string;
    translating: string;
    translateFailed: string;
    extractDialogue: string;
    extractAllDialogue: string;
    extractingDialogue: string;
    extractPreparingAudio: string;
    extractTranscribingProgress: string;
    extractFailed: string;
    noAudioTrack: string;
    extractDone: string;
    subtitlePosition: string;
    subtitlePositionBottom: string;
    subtitlePositionTop: string;
    subtitlePositionCenter: string;
    subtitleSize: string;
    subtitleSizeSmall: string;
    subtitleSizeMedium: string;
    subtitleSizeLarge: string;
    subtitleBackground: string;
    subtitleBgTransparent: string;
    subtitleBgBox: string;
    subtitleBgShadow: string;
    pressHoldHint: string;
    subtitlePreviewSample: string;
    lookAndFeel: string;
    previewBadge: string;
    ultraRequiredTitle: string;
    ultraRequiredBody: string;
    ultraRequiredLogin: string;
    upgradeToUltra: string;
  };
  lang: {
    ar: string;
    en: string;
    switchTo: string;
  };
};

export const ar: Dictionary = {
  meta: {
    titleDefault: "Vyronix — مولّد فيديو وصور AI مجاني | Kling · PixVerse",
    titleTemplate: "%s · Vyronix",
    description:
      "أنشئ فيديوهات وصور AI مجانًا — Kling · PixVerse · MiniMax · Flux. أول فيديو Vyronix مجاني · 480p/720p · vyronix.app.",
    ogTitle: "Vyronix — مولّد فيديو AI مجاني",
    ogDescription:
      "Vyronix AI Studio — Kling · PixVerse · MiniMax · توليد فيديو وصور AI، أول فيديو مجاني، استوديو تحرير · vyronix.app",
    twitterDescription: "Vyronix — أول فيديو AI مجاني · Kling · PixVerse · vyronix.app",
    homeH1: "Vyronix AI Studio — استوديو الصور والفيديو بالذكاء الاصطناعي",
    homeSeoP:
      "Vyronix AI Studio منصة رسمية على vyronix.app لتوليد الصور والفيديو بالذكاء الاصطناعي. سجّل حسابك، جرّب أول فيديو مجانًا، واختر الباقة المناسبة.",
    homeBullets: [
      "أول فيديو Vyronix مجاني مرة واحدة",
      "موديلات: VYRONIX · PixVerse · MiniMax H3 · Gemini · Kling · Seedance",
      "توليد صور وفيديو 480p / 720p",
      "محفظة كريدت وباقات شهرية",
      "واجهة عربية وإنجليزية",
    ],
  },
  nav: {
    home: "الرئيسية",
    inspire: "إلهام",
    directors: "المخرجون",
    editing: "Vyronix Editing",
    create: "إنشاء",
    tools: "أدوات",
    assets: "أصولي",
    createPick: "اختر النوع للمتابعة",
    createVideo: "فيديو VYRONIX",
    createImage: "صور VYRONIX",
    createVideoHint: "4–15 ثانية · 480p / 720p",
    createImageHint: "جودة 2K · بدون واترمارك",
    modelsStrip: "موديلات الذكاء الاصطناعي",
    invite: "ادعُ أصدقاء",
  },
  header: {
    mainNav: "التنقل الرئيسي",
    upgrade: "ترقية",
    login: "دخول",
    signup: "حساب",
    logout: "خروج",
    admin: "لوحة التحكم",
    account: "حسابي",
  },
  settings: {
    eyebrow: "الحساب",
    title: "إعدادات الحساب",
    subtitle: "عدّل اسمك وصورتك، واطّلع على اشتراكك أو ألغِه.",
    profileTab: "الملف الشخصي",
    billingTab: "الفوترة",
    avatarTitle: "صورة الحساب",
    avatarHint: "ارفع صورة JPG أو PNG (حتى 2 ميجابايت).",
    changeAvatar: "تغيير الصورة",
    avatarSaved: "تم تحديث الصورة.",
    avatarError: "تعذّر رفع الصورة — حاول مرة أخرى.",
    nameTitle: "الاسم",
    nameHint: "يظهر هذا الاسم في حسابك.",
    namePlaceholder: "اسمك",
    saveName: "حفظ الاسم",
    nameSaved: "تم حفظ الاسم.",
    nameError: "تعذّر حفظ الاسم.",
    planTitle: "باقتك الحالية",
    paidPlan: "مدفوعة",
    freePlan: "أساسية",
    creditsBalance: "رصيد الكريدت",
    monthlyCredits: "كريدت شهري",
    renewsOn: "يتجدد في",
    endsOn: "ينتهي في",
    status: "الحالة",
    manageTitle: "إدارة الاشتراك",
    manageHint: "غيّر الباقة، افتح بوابة Stripe للفواتير، أو ألغِ الاشتراك.",
    changePlan: "تغيير الباقة",
    stripePortal: "فواتير Stripe",
    cancelSubscription: "إلغاء الاشتراك",
    cancelConfirm:
      "هل تريد إلغاء الاشتراك والرجوع للباقة الأساسية؟ سيتوقف الاستقطاع الشهري.",
    cancelDone: "تم إيقاف الاشتراك والرجوع للباقة الأساسية.",
    cancelError: "تعذّر إلغاء الاشتراك.",
    portalError: "تعذّر فتح بوابة الفوترة.",
    billingLoading: "جاري تحميل تفاصيل الاشتراك…",
    loginRequired: "سجّل الدخول لإدارة حسابك.",
  },
  home: {
    brandEyebrow: "Vyronix AI Studio",
    brandTitle: "Vyronix",
    heroLine: "حوّل فكرتك إلى فيديو وصورة بالذكاء الاصطناعي خلال دقائق.",
    freeTrial: "أول فيديو مجاني مرة واحدة — سجّل وابدأ الآن",
    ctaCreate: "ابدأ الإنشاء",
    ctaPricing: "الباقات والأسعار",
    studioEyebrow: "إنشاء",
    studioTitle: "استوديو الصور والفيديو",
    studioSub: "اختر صورة أو فيديو، ثم الموديل، واكتب وصفك.",
    feedEyebrow: "من المجتمع",
    feedTitle: "إبداعات من الاستوديو",
    feedSub: "مقاطع منشورة من صنّاع Vyronix بعد الإيديتينج",
    feedLoading: "جاري تحميل المقاطع…",
  },
  storage: {
    eyebrow: "المساحة",
    title: "مساحة التخزين تقترب من الامتلاء",
    titleCritical: "مساحة التخزين ممتلئة تقريباً",
    body: "ارفع فيديوهاتك إلى Google Drive في مساحتك الخاصة، أو احذف ما لا تحتاجه من أصولك — الحذف يحرّر المساحة فعلياً الآن.",
    videosAvailable: "لديك {n} فيديو محلي يمكن نسخه أو حذفه",
    connectDrive: "ربط Google Drive والرفع",
    uploadToDrive: "رفع الأقدم إلى Drive ومسحه من هنا",
    deleteMyself: "مسح فيديوهاتي بنفسي",
    later: "لاحقاً",
    driveHint:
      "الرفع يذهب إلى حسابك في Google Drive ثم يُحذف من سيرفر Vyronix لتفريغ المساحة. يمكنك إيقاف العملية في أي وقت.",
    uploading: "جاري الرفع إلى Google Drive…",
    uploadDone: "تم رفع {n} فيديو · فشل {f}",
    uploadFailed: "تعذّر الرفع إلى Drive",
    needDrive: "اربط Google Drive أولاً",
  },
  footer: {
    blurb:
      "منصة Vyronix AI Studio لتوليد الصور والفيديو بالذكاء الاصطناعي — حسابات زبائن، محفظة كريدت، ودفع آمن عبر Stripe.",
    about: "عن Vyronix",
    faq: "الأسئلة الشائعة",
    contact: "تواصل معنا",
    privacy: "الخصوصية",
    terms: "الشروط",
    pricing: "الباقات",
    models: "الموديلات",
    rights: "جميع الحقوق محفوظة.",
    backHome: "العودة للرئيسية",
    followUs: "تابعنا",
    socialTiktok: "TikTok",
    socialYoutube: "YouTube",
    socialInstagram: "Instagram",
  },
  auth: {
    loginTitle: "تسجيل الدخول",
    signupTitle: "إنشاء حساب",
    loginSub: "ادخل لحسابك لمتابعة التوليد وإدارة الكريدت.",
    signupSub: "أنشئ حسابك وابدأ بأول فيديو مجاني على Vyronix AI Studio.",
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
    freeTrialNote: "أول فيديو Vyronix مجاني مرة واحدة للحسابات بدون رصيد.",
    stripeMissing: "الدفع غير مفعّل مؤقتًا — تواصل مع الدعم.",
  },
  about: {
    title: "عن Vyronix AI Studio",
    p1: "Vyronix AI Studio استوديو لتوليد الصور والفيديو بالذكاء الاصطناعي على الدومين الرسمي https://vyronix.app.",
    p2: "نقدّم حسابات زبائن، محفظة كريدت، باقات شهرية، وتجربة إنشاء مباشرة من المتصفح — مع دفع آمن عبر Stripe وتسجيل اختياري عبر Google.",
    featuresTitle: "ما يميزنا",
    features: [
      "واجهة عربية وإنجليزية لإنشاء الصور والفيديو.",
      "تسعير بالكريدت شفاف قبل التوليد.",
      "تجربة مجانية محدودة لأول فيديو Vyronix وفق الشروط المعروضة.",
      "استضافة إنتاج دائمة على بنية تحتية سحابية مع نطاق مخصص.",
    ],
    contactTitle: "التواصل الرسمي",
  },
  faq: {
    title: "الأسئلة الشائعة",
    items: [
      {
        q: "هل يوجد فيديو مجاني؟",
        a: "نعم — أول فيديو Vyronix مجاني مرة واحدة للحسابات بدون رصيد، وفق الشروط المعروضة في الاستوديو.",
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
  seoPages: {
    pricingDescription:
      "باقات Vyronix AI Studio الشهرية وشحن الكريدت — أول فيديو AI مجاني، موديلات VYRONIX وPixVerse وKling، دفع آمن عبر Stripe على vyronix.app.",
    faqDescription:
      "أسئلة شائعة عن Vyronix AI Studio: التجربة المجانية، الكريدت، الموديلات، الدفع، والوضوح 480p/720p على vyronix.app.",
    toolsDescription:
      "أدوات Vyronix AI Studio — إنشاء فيديو وصور بالذكاء الاصطناعي، مكتبة الأصول، استوديو التحرير، والموديلات على vyronix.app.",
    editTitle: "محرر فيديو AI — قص · دمج · ترجمة",
    editDescription:
      "حرّر ودمّج فيديوهات AI — قص، فلاتر، ترجمة تلقائية، تصدير 1080p. Kling · PixVerse · Vyronix · vyronix.app/edit",
  },
  seoLandings: {
    aiVideo: "مولّد فيديو AI",
    aiImage: "مولّد صور AI",
    textToVideo: "تحويل النص إلى فيديو",
    aiEditor: "محرر فيديو AI",
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
      "باستخدامك Vyronix AI Studio فإنك توافق على الاستخدام المشروع للمحتوى الذي تنشئه.",
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
    characterIdentityTitle: "ثبات الشخصية والملامح",
    characterIdentityNote:
      "هذا يثبت الشكل — لا علاقة له بـ «تصفير التسلسل». استخدم نفس الصورة في كل مشهد.",
    characterStepUpload: "ارفع صورة واضحة للوجه (شخص واحد لكل صورة)",
    characterStepName: "سمِّ الشخصية تحت الصورة (مثال: ليلى)",
    characterStepPrompt: "اذكر الاسم في الوصف قبل Generate",
    characterStepSameSettings: "نفس الموديل والجودة في كل مشهد للمسلسل",
    characterStepFromGeneration:
      "بدون صورة؟ من «أصولي» → «متابعة الشخصية» على أول فيديو ناجح",
    characterFromGenerationLoaded:
      "تم تحميل وجه من فيديو سابق — اذكر الاسم في الوصف ثم Generate",
    characterIdentityLinked: "مربوط — الملامح من الصورة المرجعية",
    characterIdentityUnlinked: "ارفع صورة + اسم + اذكر الاسم في الوصف",
    sceneSequenceTitle: "تسلسل القصة (بعد تحسين)",
    resetSequence: "تصفير التسلسل",
    resetSequenceHint:
      "يقطع استمرارية المشهد السابق (من واقف، آخر فعل…). للحلقة الجديدة — لا يثبت الوجه ولا يمسح الصورة المرجعية.",
    resetSequenceIdle: "لا يوجد تسلسل بعد — اضغط «تحسين» إن أردت ربط المشاهد المتتابعة",
    resetSequenceActive: "تسلسل نشط — المشهد التالي يرث آخر تحسين",
    resetSequenceDone: "تم تصفير تسلسل القصة — المشهد التالي مستقل (الصور المرجعية كما هي)",
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
      "أول فيديو على Vyronix مجاني مرة واحدة — مقدمة Vyronix + 4 ثوانٍ · 768P.",
    outputCount: "عدد الفيديوهات",
    native720Note: "720p أصلي — لا حاجة لترقية وضوح إضافية",
    clarityUpgrade: "ترقية وضوح 480→720",
    resultPreview: "معاينة النتيجة",
    resultVideos: "فيديو",
    resultImages: "صور",
    resultAll: "الكل",
    resultReady: "جاهز",
    resultShare: "شير",
    resultEmpty: "لا توجد معاينة بعد",
  },
  assets: {
    video: "فيديو",
    photos: "صور",
    browse: "تصفح",
    grid: "فرز",
    play: "تشغيل",
    pause: "إيقاف",
    edit: "تعديل",
    continueCharacter: "متابعة الشخصية",
    continueCharacterHint:
      "يلتقط إطاراً من هذا الفيديو ويفتح الإنشاء — للمسلسل بدون رفع صورة يدوياً",
    sendToStudio: "نقل إلى الاستديو",
    sentToStudio: "تم النقل",
    selectedCount: "تم تحديد {n} فيديو",
    clearSelection: "إلغاء التحديد",
    delete: "حذف",
    download: "تحميل",
    showMore: "عرض المزيد",
    showLess: "عرض أقل",
    promptLabel: "الوصف الكامل",
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
  models: {
    eyebrow: "الموديلات",
    title: "موديلات AI — Kling · PixVerse · Flux · Vyronix",
    subtitle:
      "Kling 2.5 · PixVerse V6 · Flux · Reve · Wan · MiniMax — صور وفيديو AI من نص أو صورة. أول فيديو مجاني · vyronix.app/models",
    videoTitle: "موديلات الفيديو",
    videoSub: "Text-to-video و image-to-video مع دعم الشخصيات والإطارات.",
    imageTitle: "موديلات الصور",
    imageSub: "Text-to-image و image-to-image بجودة عالية.",
    available: "متاح",
    soon: "قريبًا",
    video: "فيديو",
    image: "صورة",
    footerNote:
      "اضغط أي موديل للانتقال إلى الاستوديو. الموديلات القادمة تظهر للمعاينة وستُفعَّل تدريجيًا.",
    detailAbout: "عن الموديل",
    detailVideoBody: "أنشئ فيديوهات احترافية بالذكاء الاصطناعي باستخدام",
    detailImageBody: "أنشئ صورًا بالذكاء الاصطناعي باستخدام",
    detailAvailable: " — متاح الآن على Vyronix AI Studio.",
    detailSoon: " — قريبًا على Vyronix AI Studio.",
    detailCta: "ابدأ الإنشاء",
  },
  inspire: {
    eyebrow: "إلهام",
    title: "أفلام ومسلسلات ترند",
    subtitle:
      "تصفّح الأعمال الرائجة، اختر ما يلهمك، وابدأ إنشاء فيديو بأسلوب سينمائي جاهز.",
    tabList: "تصنيف المحتوى",
    tabTrending: "ترند",
    tabMovies: "أفلام",
    tabSeries: "مسلسلات",
    tabAll: "الكل",
    allGenres: "كل الأنواع",
    searchPlaceholder: "ابحث عن فيلم أو مسلسل…",
    refresh: "تحديث",
    movie: "فيلم",
    series: "مسلسل",
    trendingBadge: "ترند",
    usePrompt: "استخدم الفكرة",
    empty: "لا توجد نتائج — جرّب تصنيفًا أو بحثًا مختلفًا.",
    loading: "جاري التحميل…",
    error: "تعذّر تحميل الإلهام — حاول مرة أخرى.",
    promptLabel: "وصف جاهز للإنشاء",
    createCta: "إنشاء فيديو",
    copyPrompt: "نسخ الوصف",
    copied: "تم النسخ",
    close: "إغلاق",
    tmdbNote: "صور الأعمال من Wikipedia وTMDB — للإلهام الإبداعي فقط.",
    genres: {
      action: "أكشن",
      drama: "دراما",
      "sci-fi": "خيال علمي",
      horror: "رعب",
      comedy: "كوميديا",
      romance: "رومانس",
      thriller: "إثارة",
      fantasy: "فانتازيا",
      animation: "رسوم متحركة",
      crime: "جريمة",
    },
  },
  directors: {
    eyebrow: "Directors",
    title: "أساليب المخرجين",
    subtitle:
      "اختر أسلوبًا بصريًا لمخرج مشهور وابدأ إنشاء فيديو بprompt سينمائي جاهز.",
    searchPlaceholder: "ابحث عن مخرج…",
    usePrompt: "استخدم الأسلوب",
    empty: "لا توجد نتائج — جرّب بحثًا مختلفًا.",
    promptLabel: "وصف جاهز للإنشاء",
    createCta: "إنشاء فيديو",
    copyPrompt: "نسخ الوصف",
    copied: "تم النسخ",
    close: "إغلاق",
  },
  invite: {
    eyebrow: "نمو",
    title: "ادعُ أصدقاءك واكسب كريدت",
    subtitle:
      "شارك رابطك. عندما يسجّل صديق حسابًا جديدًا، يحصل على كريدت مجاني وأنت تكسب مكافأة.",
    loginRequired: "سجّل الدخول لتحصل على رابط الدعوة الخاص بك.",
    loading: "جاري تحميل رابطك…",
    rewardTitle: "المكافآت",
    rewardYou: "أنت: +{n} كريدت لكل صديق يسجّل",
    rewardFriend: "صديقك: +{n} كريدت عند التسجيل",
    yourLink: "رابط الدعوة",
    copy: "نسخ",
    share: "مشاركة",
    copied: "تم نسخ الرابط",
    copyFailed: "تعذّر النسخ",
    shared: "تمت المشاركة",
    shareFailed: "تعذّرت المشاركة",
  },
  editStudio: {
    tab: "الإيديتينج",
    tabList: "تبويبات الاستوديو",
    title: "استوديو الإيديتينج",
    subtitle: "قصّ الفيديو، غيّر النسبة، طبّق فلاتر، وصدّر — كل المعالجة على جهازك بدون تحميل على السيرفر.",
    trim: "قص الفيديو",
    trimStart: "البداية",
    trimEnd: "النهاية",
    trimLock: "تثبيت القص",
    aspect: "نسبة العرض",
    filters: "الفلاتر",
    filterNone: "بدون",
    filterCinematic: "سينمائي",
    filterVintage: "كلاسيك",
    filterContrast: "تباين",
    filterBw: "أبيض وأسود",
    export: "تصدير / تحميل",
    exporting: "جاري التصدير",
    exportServerProcessing: "جاري التصدير 1080p على السيرفر…",
    exportDone: "تم التحميل بنجاح",
    exportDoneNewTab: "افتح التبويب الجديد للمعاينة والتحميل",
    exportFailed: "فشل التصدير — جرّب فيديو أقصر أو متصفحًا آخر",
    exportAudioFailed:
      "تعذّر دمج الصوت — جرّب «عادي 720p»، أو صدّر بدون انتقالات، أو حمّل من الأصول مباشرة.",
    exportMemoryFailed:
      "نفاد ذاكرة المتصفح أثناء 1080p — جرّب «عادي 720p» أو مقطعًا أقصر.",
    clear: "مسح الفيديو",
    noVideo: "لا يوجد فيديو في الاستديو",
    noVideoHint: "من «أصولي» أو نتائج التوليد، اضغط «نقل إلى الاستديو» لتحميل مقطع هنا.",
    clientNote: "المعالجة بالكامل على متصفحك (FFmpeg.wasm) — لا استهلاك لموارد السيرفر.",
    timeline: "الخط الزمني",
    clipCount: "{n} مقطع",
    moveBack: "تأخير",
    moveForward: "تقديم",
    deleteClip: "حذف",
    mergeExport: "دمج الفيديو",
    exportActiveClip: "تصدير المقطع النشط",
    exportQuality: "جودة التحميل",
    exportQualityStandard: "عادي · 720p",
    exportQualityHigh: "عالي · 1080p",
    exportQualityStandardHint: "720p — تصدير أسرع، مناسب للمعاينة السريعة.",
    exportQualityHighHint: "1080p — أوضح للنشر على TikTok وReels وYouTube (يستغرق وقتاً أطول).",
    publishToHome: "نشر على الهوم",
    publishing: "جاري النشر…",
    publishDone: "تم النشر على الصفحة الرئيسية",
    publishFailed: "تعذّر النشر — حاول مرة أخرى",
    publishedToHome: "منشور على الهوم",
    viewOnHome: "عرض على الهوم",
    clearAll: "مسح الكل",
    transition: "انتقال",
    transitionNone: "بدون",
    transitionFade: "تلاشي",
    transitionDissolve: "ذوبان",
    transitionWipe: "مسح",
    subtitlesTitle: "الترجمة والترجمة النصية",
    manualDialogueHint: "أضف سطوراً يدوياً أو عدّل الأوقات (مثال: 0:05 أو 1:30). يمكنك أيضاً الاستخراج التلقائي من الصوت أدناه.",
    addDialogueLine: "إضافة سطر",
    addDialogueAtPlayhead: "إضافة عند الموضع الحالي",
    dialogueStartTime: "البداية",
    dialogueEndTime: "النهاية",
    deleteDialogueLine: "حذف السطر",
    extractAllHint: "استخراج الحوار على جهازك (FFmpeg) ثم Gemini — بدون تحميل الفيدio على السيرفر.",
    manualDialogueLabel: "كتابة يدوية",
    setStartToPlayhead: "← البداية هنا",
    setEndToPlayhead: "← النهاية هنا",
    dialogueSpeakerOptional: "الشخصية (اختياري)",
    charactersOptionalLabel: "تصفية حسب شخصية (اختياري)",
    subtitleClock: "وقت الترجمة",
    subtitleWaiting: "بانتظار السطر التالي",
    dialoguePlaceholder: "اكتب الحوار هنا…",
    dialogueSpeaker: "الشخصية",
    dialogueLinesEmpty: "لا توجد سطور — اضغط «إضافة سطر» للكتابة يدوياً، أو استخدم الاستخراج التلقائي",
    charactersTitle: "الشخصيات",
    characterNamePlaceholder: "اسم الشخصية (مثال: أحمد)",
    addCharacter: "إضافة",
    deleteCharacter: "حذف الشخصية",
    charactersHint: "اختياري — لاستخراج حوار شخصية محددة فقط. الاستخراج العام لا يحتاج أسماء.",
    characterExists: "هذه الشخصية مضافة مسبقاً",
    selectCharacterFirst: "اختر شخصية أولاً",
    extractCharacterDialogue: "استخراج حوار {name}",
    extractCharacterDialoguePick: "استخراج حوار الشخصية",
    extractAllSpeech: "استخراج كل الحوار (بدون اسم شخصية)",
    extractAllSpeechDone: "تم استخراج كل الحوار",
    extractFallback: "تم الاستخراج — راجع أسماء الشخصيات وعدّلها إن لزم",
    extractAllCharacters: "استخراج كل الشخصيات",
    extractDoneForCharacter: "تم استخراج حوار {name}",
    extractAllDone: "تم استخراج حوار كل الشخصيات",
    noDialogueForCharacter: "لم يُعثر على حوار لهذه الشخصية في المقطع",
    noDialogueInClip: "لم يُعثر على حوار — أضف السطور يدوياً أو جرّب مقطعاً أقصر",
    translateToArabic: "ترجمة للعربية",
    translating: "جاري الترجمة…",
    translateFailed: "تعذّرت الترجمة — حاول مرة أخرى",
    extractDialogue: "استخراج الحوار من المقطع",
    extractAllDialogue: "استخراج حوار كل المقاطع",
    extractingDialogue: "جاري استخراج الحوار…",
    extractPreparingAudio: "جاري تحضير الصوت على جهازك…",
    extractTranscribingProgress: "جاري تحليل الصوت {current}/{total}…",
    extractFailed: "تعذّر استخراج الحوار — حاول مرة أخرى",
    noAudioTrack: "لا يوجد مسار صوت في هذا المقطع — جرّب فيديو فيه كلام أو فعّل الصوت عند التوليد",
    extractDone: "تم استخراج الحوار",
    subtitlePosition: "موضع النص",
    subtitlePositionBottom: "أسفل",
    subtitlePositionTop: "أعلى",
    subtitlePositionCenter: "وسط",
    subtitleSize: "حجم الخط",
    subtitleSizeSmall: "صغير",
    subtitleSizeMedium: "متوسط",
    subtitleSizeLarge: "كبير",
    subtitleBackground: "خلفية النص",
    subtitleBgTransparent: "شفاف",
    subtitleBgBox: "صندوق أسود",
    subtitleBgShadow: "ظل",
    pressHoldHint: "👇 اضغط مطولاً على أي زر — شاهد الفيديو — ارفع إصبعك للحفظ",
    subtitlePreviewSample: "معاينة الترجمة على الفيديو",
    lookAndFeel: "المظهر — نسبة العرض والفلاتر",
    previewBadge: "معاينة",
    ultraRequiredTitle: "استوديو الإيديتينج — باقة الترا",
    ultraRequiredBody:
      "قصّ الفيديو، الدمج، الفلاتر، والترجمة التلقائية متاحة فقط لمشتركي باقة الترا. رقِّ اشتراكك للوصول الكامل.",
    ultraRequiredLogin: "سجّل الدخول أولاً ثم رقِّ إلى باقة الترا.",
    upgradeToUltra: "الترقية إلى باقة الترا",
  },
  lang: {
    ar: "العربية",
    en: "English",
    switchTo: "اللغة",
  },
};

export const en: Dictionary = {
  meta: {
    titleDefault: "Vyronix — Free AI Video & Image Generator | Kling · PixVerse",
    titleTemplate: "%s · Vyronix",
    description:
      "Create free AI videos and images — Kling · PixVerse · MiniMax · Flux. Free first Vyronix video · 480p/720p · vyronix.app.",
    ogTitle: "Vyronix — Free AI Video Generator",
    ogDescription:
      "Vyronix AI Studio — Kling · PixVerse · MiniMax · AI video & image generation, free first video, edit studio · vyronix.app",
    twitterDescription: "Vyronix — free first AI video · Kling · PixVerse · vyronix.app",
    homeH1: "Vyronix AI Studio — AI Image & Video Studio",
    homeSeoP:
      "Vyronix AI Studio is the official studio on vyronix.app for AI image and video generation. Sign up, try your first free video, and pick a plan that fits.",
    homeBullets: [
      "One free Vyronix video per new empty wallet",
      "Models: VYRONIX · PixVerse · MiniMax H3 · Gemini · Kling · Seedance",
      "Image & video at 480p / 720p",
      "Credit wallet and monthly plans",
      "Arabic and English interface",
    ],
  },
  nav: {
    home: "Home",
    inspire: "Inspire",
    directors: "Directors",
    editing: "Vyronix Editing",
    create: "Create",
    tools: "Tools",
    assets: "Assets",
    createPick: "Choose a type to continue",
    createVideo: "VYRONIX Video",
    createImage: "VYRONIX Image",
    createVideoHint: "4–15s · 480p / 720p",
    createImageHint: "2K quality · no watermark",
    modelsStrip: "AI models",
    invite: "Invite",
  },
  header: {
    mainNav: "Main navigation",
    upgrade: "Upgrade",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    admin: "Admin",
    account: "Account",
  },
  settings: {
    eyebrow: "Account",
    title: "Account settings",
    subtitle: "Update your name and photo, view or cancel your subscription.",
    profileTab: "Profile",
    billingTab: "Billing",
    avatarTitle: "Profile photo",
    avatarHint: "Upload JPG or PNG (max 2 MB).",
    changeAvatar: "Change photo",
    avatarSaved: "Photo updated.",
    avatarError: "Could not upload photo — try again.",
    nameTitle: "Display name",
    nameHint: "This name appears on your account.",
    namePlaceholder: "Your name",
    saveName: "Save name",
    nameSaved: "Name saved.",
    nameError: "Could not save name.",
    planTitle: "Current plan",
    paidPlan: "Paid",
    freePlan: "Free",
    creditsBalance: "Credit balance",
    monthlyCredits: "Monthly credits",
    renewsOn: "Renews on",
    endsOn: "Ends on",
    status: "Status",
    manageTitle: "Manage subscription",
    manageHint: "Change plan, open Stripe billing portal, or cancel.",
    changePlan: "Change plan",
    stripePortal: "Stripe billing",
    cancelSubscription: "Cancel subscription",
    cancelConfirm:
      "Cancel your subscription and switch to the free plan? Monthly billing will stop.",
    cancelDone: "Subscription canceled — you are on the free plan.",
    cancelError: "Could not cancel subscription.",
    portalError: "Could not open billing portal.",
    billingLoading: "Loading subscription details…",
    loginRequired: "Log in to manage your account.",
  },
  home: {
    brandEyebrow: "Vyronix AI Studio",
    brandTitle: "Vyronix",
    heroLine: "Turn your idea into AI video and images in minutes.",
    freeTrial: "First video free once — sign up and start now",
    ctaCreate: "Start creating",
    ctaPricing: "Plans & pricing",
    studioEyebrow: "Create",
    studioTitle: "Image & video studio",
    studioSub: "Pick image or video, choose a model, then write your prompt.",
    feedEyebrow: "Community",
    feedTitle: "Studio creations",
    feedSub: "Videos published by Vyronix creators after editing",
    feedLoading: "Loading feed…",
  },
  storage: {
    eyebrow: "Storage",
    title: "Storage is almost full",
    titleCritical: "Storage is critically full",
    body: "Back up your videos to your own Google Drive, or delete what you no longer need — deletes now free disk space for real.",
    videosAvailable: "You have {n} local videos you can move or delete",
    connectDrive: "Connect Google Drive & upload",
    uploadToDrive: "Upload oldest to Drive & remove here",
    deleteMyself: "Delete my videos myself",
    later: "Later",
    driveHint:
      "Files go to your Google Drive account, then are removed from Vyronix to free space. You can stop anytime.",
    uploading: "Uploading to Google Drive…",
    uploadDone: "Uploaded {n} · failed {f}",
    uploadFailed: "Could not upload to Drive",
    needDrive: "Connect Google Drive first",
  },
  footer: {
    blurb:
      "Vyronix AI Studio generates AI images and videos — customer accounts, credit wallet, and secure Stripe payments.",
    about: "About",
    faq: "FAQ",
    contact: "Contact",
    privacy: "Privacy",
    terms: "Terms",
    pricing: "Pricing",
    models: "Models",
    rights: "All rights reserved.",
    backHome: "Back to home",
    followUs: "Follow us",
    socialTiktok: "TikTok",
    socialYoutube: "YouTube",
    socialInstagram: "Instagram",
  },
  auth: {
    loginTitle: "Log in",
    signupTitle: "Create account",
    loginSub: "Sign in to keep generating and manage your credits.",
    signupSub: "Create your account and start with a free Vyronix video.",
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
    freeTrialNote: "First Vyronix video is free once for empty wallets.",
    stripeMissing: "Checkout is temporarily unavailable — contact support.",
  },
  about: {
    title: "About Vyronix AI Studio",
    p1: "Vyronix AI Studio is an AI image and video studio on the official domain https://vyronix.app.",
    p2: "We offer customer accounts, a credit wallet, monthly plans, and in-browser creation — with secure Stripe payments and optional Google sign-in.",
    featuresTitle: "What we offer",
    features: [
      "Arabic and English UI for images and video.",
      "Transparent credit pricing before you generate.",
      "Limited free first Vyronix video under the shown terms.",
      "Production hosting on cloud infrastructure with a custom domain.",
    ],
    contactTitle: "Official contact",
  },
  faq: {
    title: "FAQ",
    items: [
      {
        q: "Is there a free video?",
        a: "Yes — one free Vyronix video for empty wallets, under the terms shown in the studio.",
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
  seoPages: {
    pricingDescription:
      "Vyronix AI Studio pricing — monthly plans and credit top-ups, free first AI video, VYRONIX · PixVerse · Kling models, secure Stripe checkout on vyronix.app.",
    faqDescription:
      "Vyronix AI Studio FAQ — free trial, credits, AI models, billing, and 480p/720p video on vyronix.app.",
    toolsDescription:
      "Vyronix AI Studio tools — AI video & image creation, asset library, edit studio, and model shortcuts on vyronix.app.",
    editTitle: "AI Video Editor — Trim · Merge · Subtitles",
    editDescription:
      "Edit and merge AI videos — trim, filters, auto subtitles, 1080p export. Kling · PixVerse · Vyronix · vyronix.app/edit",
  },
  seoLandings: {
    aiVideo: "AI Video Generator",
    aiImage: "AI Image Generator",
    textToVideo: "Text to Video",
    aiEditor: "AI Video Editor",
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
      "By using Vyronix AI Studio you agree to create and use content lawfully.",
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
    characterNamePlaceholder: "e.g. Layla",
    characterIdentityTitle: "Character identity",
    characterIdentityNote:
      "This locks appearance — unrelated to “Reset sequence”. Reuse the same photo every shot.",
    characterStepUpload: "Upload a clear face photo (one person per image)",
    characterStepName: "Name the character under the photo (e.g. Layla)",
    characterStepPrompt: "Mention the name in your prompt before Generate",
    characterStepSameSettings: "Same model & quality across every episode shot",
    characterStepFromGeneration:
      "No photo? In Assets → “Continue character” on your first good video",
    characterFromGenerationLoaded:
      "Face loaded from a prior video — mention the name in your prompt, then Generate",
    characterIdentityLinked: "Linked — face comes from the reference photo",
    characterIdentityUnlinked: "Upload + name + mention the name in your prompt",
    sceneSequenceTitle: "Story sequence (after Enhance)",
    resetSequence: "Reset sequence",
    resetSequenceHint:
      "Breaks scene continuity (poses, last action…). For a new episode — does not lock or clear reference photos.",
    resetSequenceIdle: "No sequence yet — use Enhance first to chain consecutive scenes",
    resetSequenceActive: "Sequence active — next scene inherits the last Enhance",
    resetSequenceDone: "Story sequence cleared — next scene is independent (refs unchanged)",
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
      "Your first Vyronix video is free once — Vyronix intro + 4s · 768P.",
    outputCount: "Video count",
    native720Note: "Native 720p — no extra clarity upgrade needed",
    clarityUpgrade: "Clarity upgrade 480→720",
    resultPreview: "Result preview",
    resultVideos: "Video",
    resultImages: "Images",
    resultAll: "All",
    resultReady: "Ready",
    resultShare: "Share",
    resultEmpty: "No preview yet",
  },
  assets: {
    video: "Video",
    photos: "Photos",
    browse: "Browse",
    grid: "Grid",
    play: "Play",
    pause: "Pause",
    edit: "Edit",
    continueCharacter: "Continue character",
    continueCharacterHint:
      "Captures a frame from this video and opens Create — for series without manual photo upload",
    sendToStudio: "Send to studio",
    sentToStudio: "Sent to studio",
    selectedCount: "{n} videos selected",
    clearSelection: "Clear selection",
    delete: "Delete",
    download: "Download",
    showMore: "Show more",
    showLess: "Show less",
    promptLabel: "Full prompt",
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
  models: {
    eyebrow: "Models",
    title: "AI Models — Kling · PixVerse · Flux · Vyronix",
    subtitle:
      "Kling 2.5 · PixVerse V6 · Flux · Reve · Wan · MiniMax — AI images and video from text or reference. Free first video · vyronix.app/models",
    videoTitle: "Video models",
    videoSub: "Text-to-video and image-to-video with characters and frame control.",
    imageTitle: "Image models",
    imageSub: "Text-to-image and image-to-image at high quality.",
    available: "Available",
    soon: "Coming soon",
    video: "Video",
    image: "Image",
    footerNote:
      "Tap any model to open the studio. Upcoming models are listed for preview and roll out over time.",
    detailAbout: "About this model",
    detailVideoBody: "Create professional AI videos with",
    detailImageBody: "Create AI images with",
    detailAvailable: " — available now on Vyronix AI Studio.",
    detailSoon: " — coming soon on Vyronix AI Studio.",
    detailCta: "Start creating",
  },
  inspire: {
    eyebrow: "Inspire",
    title: "Trending movies & series",
    subtitle:
      "Browse what's hot, pick a title that inspires you, and jump into Create with a cinematic prompt.",
    tabList: "Content categories",
    tabTrending: "Trending",
    tabMovies: "Movies",
    tabSeries: "Series",
    tabAll: "All",
    allGenres: "All genres",
    searchPlaceholder: "Search a movie or series…",
    refresh: "Refresh",
    movie: "Movie",
    series: "Series",
    trendingBadge: "Trending",
    usePrompt: "Use this idea",
    empty: "No results — try another category or search.",
    loading: "Loading…",
    error: "Could not load inspire feed — try again.",
    promptLabel: "Ready-to-use prompt",
    createCta: "Create video",
    copyPrompt: "Copy prompt",
    copied: "Copied",
    close: "Close",
    tmdbNote: "Title art from Wikipedia & TMDB — for creative inspiration only.",
    genres: {
      action: "Action",
      drama: "Drama",
      "sci-fi": "Sci-Fi",
      horror: "Horror",
      comedy: "Comedy",
      romance: "Romance",
      thriller: "Thriller",
      fantasy: "Fantasy",
      animation: "Animation",
      crime: "Crime",
    },
  },
  directors: {
    eyebrow: "Directors",
    title: "Director visual styles",
    subtitle:
      "Pick a famous director's look and jump into Create with a cinematic prompt ready to go.",
    searchPlaceholder: "Search a director…",
    usePrompt: "Use this style",
    empty: "No results — try a different search.",
    promptLabel: "Ready-to-use prompt",
    createCta: "Create video",
    copyPrompt: "Copy prompt",
    copied: "Copied",
    close: "Close",
  },
  invite: {
    eyebrow: "Growth",
    title: "Invite friends, earn credits",
    subtitle:
      "Share your link. When a friend signs up, they get free credits and you earn a bonus.",
    loginRequired: "Sign in to get your personal invite link.",
    loading: "Loading your link…",
    rewardTitle: "Rewards",
    rewardYou: "You: +{n} credits per friend signup",
    rewardFriend: "Friend: +{n} credits on signup",
    yourLink: "Invite link",
    copy: "Copy",
    share: "Share",
    copied: "Link copied",
    copyFailed: "Could not copy",
    shared: "Shared",
    shareFailed: "Could not share",
  },
  editStudio: {
    tab: "Editing",
    tabList: "Studio tabs",
    title: "Editing studio",
    subtitle: "Trim, change aspect ratio, apply filters, and export — all processing runs in your browser with zero server load.",
    trim: "Trim video",
    trimStart: "Start",
    trimEnd: "End",
    trimLock: "Lock trim",
    aspect: "Aspect ratio",
    filters: "Filters",
    filterNone: "None",
    filterCinematic: "Cinematic",
    filterVintage: "Vintage",
    filterContrast: "Contrast",
    filterBw: "B&W",
    export: "Export / download",
    exporting: "Exporting",
    exportServerProcessing: "Exporting 1080p on server…",
    exportDone: "Download started",
    exportDoneNewTab: "Open the new tab to preview and download",
    exportFailed: "Export failed — try a shorter clip or another browser",
    exportAudioFailed:
      "Could not merge audio — try Standard 720p, export without transitions, or download from Assets.",
    exportMemoryFailed:
      "Browser ran out of memory during 1080p — try Standard 720p or a shorter clip.",
    clear: "Clear video",
    noVideo: "No video loaded in the studio",
    noVideoHint: "From Assets or generation results, tap “Send to studio” to load a clip here.",
    clientNote: "100% client-side processing (FFmpeg.wasm) — no server CPU/GPU used.",
    timeline: "Timeline",
    clipCount: "{n} clips",
    moveBack: "Move back",
    moveForward: "Move forward",
    deleteClip: "Delete",
    mergeExport: "Merge & export",
    exportActiveClip: "Export active clip",
    exportQuality: "Download quality",
    exportQualityStandard: "Standard · 720p",
    exportQualityHigh: "High · 1080p",
    exportQualityStandardHint: "720p — faster export, good for quick previews.",
    exportQualityHighHint: "1080p — sharper for TikTok, Reels, and YouTube (takes longer).",
    publishToHome: "Publish to home",
    publishing: "Publishing…",
    publishDone: "Published on the home page",
    publishFailed: "Could not publish — try again",
    publishedToHome: "Published on home",
    viewOnHome: "View on home",
    clearAll: "Clear all",
    transition: "Transition",
    transitionNone: "None",
    transitionFade: "Fade",
    transitionDissolve: "Dissolve",
    transitionWipe: "Wipe",
    subtitlesTitle: "Subtitles & dialogue",
    manualDialogueHint: "Add lines manually or edit times (e.g. 0:05 or 1:30). You can also auto-extract from audio below.",
    addDialogueLine: "Add line",
    addDialogueAtPlayhead: "Add at playhead",
    dialogueStartTime: "Start",
    dialogueEndTime: "End",
    deleteDialogueLine: "Delete line",
    extractAllHint: "Dialogue runs on your device (FFmpeg) then Gemini — no full video upload to the server.",
    manualDialogueLabel: "Manual entry",
    setStartToPlayhead: "← Start here",
    setEndToPlayhead: "← End here",
    dialogueSpeakerOptional: "Character (optional)",
    charactersOptionalLabel: "Filter by character (optional)",
    subtitleClock: "Subtitle time",
    subtitleWaiting: "waiting for next line",
    dialoguePlaceholder: "Type dialogue here…",
    dialogueSpeaker: "Character",
    dialogueLinesEmpty: "No lines yet — tap “Add line” to type manually, or use auto-extract",
    charactersTitle: "Characters",
    characterNamePlaceholder: "Character name (e.g. Ahmed)",
    addCharacter: "Add",
    deleteCharacter: "Remove character",
    charactersHint: "Optional — only needed to extract one character's lines. General extraction needs no names.",
    characterExists: "This character is already added",
    selectCharacterFirst: "Select a character first",
    extractCharacterDialogue: "Extract {name}'s dialogue",
    extractCharacterDialoguePick: "Extract character dialogue",
    extractAllSpeech: "Extract all dialogue (no character name)",
    extractAllSpeechDone: "All dialogue extracted",
    extractFallback: "Extracted — review character names and edit if needed",
    extractAllCharacters: "Extract all characters",
    extractDoneForCharacter: "Extracted dialogue for {name}",
    extractAllDone: "Extracted all characters' dialogue",
    noDialogueForCharacter: "No dialogue found for this character in the clip",
    noDialogueInClip: "No dialogue detected — add lines manually or try a shorter clip",
    translateToArabic: "Translate to Arabic",
    translating: "Translating…",
    translateFailed: "Translation failed — try again",
    extractDialogue: "Extract dialogue from clip",
    extractAllDialogue: "Extract dialogue from all clips",
    extractingDialogue: "Extracting dialogue…",
    extractPreparingAudio: "Preparing audio on your device…",
    extractTranscribingProgress: "Analyzing audio {current}/{total}…",
    extractFailed: "Could not extract dialogue — try again",
    noAudioTrack: "No clear audio in this clip",
    extractDone: "Dialogue extracted",
    subtitlePosition: "Text position",
    subtitlePositionBottom: "Bottom",
    subtitlePositionTop: "Top",
    subtitlePositionCenter: "Center",
    subtitleSize: "Font size",
    subtitleSizeSmall: "Small",
    subtitleSizeMedium: "Medium",
    subtitleSizeLarge: "Large",
    subtitleBackground: "Text background",
    subtitleBgTransparent: "Transparent",
    subtitleBgBox: "Black box",
    subtitleBgShadow: "Shadow",
    pressHoldHint: "👇 Press and hold any option — watch the video — release to save",
    subtitlePreviewSample: "Subtitle preview on video",
    lookAndFeel: "Look — aspect ratio & filters",
    previewBadge: "Preview",
    ultraRequiredTitle: "Editing studio — Ultra plan",
    ultraRequiredBody:
      "Trim, merge, filters, and auto subtitles are available on the Ultra plan only. Upgrade to unlock full editing.",
    ultraRequiredLogin: "Sign in first, then upgrade to Ultra.",
    upgradeToUltra: "Upgrade to Ultra",
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
