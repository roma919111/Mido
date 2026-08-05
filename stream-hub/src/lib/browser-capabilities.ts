export type PlaybackEnvironment = {
  canPlayInBrowser: boolean;
  isEmbeddedBrowser: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isNativeApp: boolean;
  warning: string | null;
  recommendation: string;
};

function isEmbeddedBrowser(): boolean {
  const ua = navigator.userAgent;
  return (
    /Cursor|Electron|Headless|Playwright|Puppeteer/i.test(ua) ||
    (navigator as Navigator & { webdriver?: boolean }).webdriver === true
  );
}

export function getPlaybackEnvironment(isNativeApp = false): PlaybackEnvironment {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const embedded = isEmbeddedBrowser();

  if (isNativeApp) {
    return {
      canPlayInBrowser: true,
      isEmbeddedBrowser: embedded,
      isAndroid,
      isIOS,
      isNativeApp: true,
      warning: null,
      recommendation:
        "يُفتح Netflix/شاهد في المتصفح داخل MAX — اضغط ✕ للرجوع. لا حاجة لتحميل تطبيقات المنصات.",
    };
  }

  if (embedded) {
    return {
      canPlayInBrowser: false,
      isEmbeddedBrowser: true,
      isAndroid,
      isIOS,
      isNativeApp: false,
      warning:
        "متصفح Cursor/المدمج لا يدعم DRM (Widevine). Netflix وشاهد يرفضون التشغيل هنا حتى لو الموقع رسمي.",
      recommendation: isAndroid
        ? "افتح MAX في Chrome على الموبايل أو ثبّت APK — يُفتح المحتوى في المتصفح بدون تحميل Netflix."
        : "افتح الرابط في Chrome أو Safari على جهازك الحقيقي — لا تستخدم متصفح Cursor.",
    };
  }

  if (isAndroid || isIOS) {
    return {
      canPlayInBrowser: true,
      isEmbeddedBrowser: false,
      isAndroid,
      isIOS,
      isNativeApp: false,
      warning: null,
      recommendation:
        "يُفتح المحتوى في المتصفح من MAX — سجّل دخولك مرة واحدة في netflix.com أو shahid.mbc.net.",
    };
  }

  return {
    canPlayInBrowser: true,
    isEmbeddedBrowser: false,
    isAndroid,
    isIOS,
    isNativeApp: false,
    warning: null,
    recommendation: "استخدم Chrome — سجّل دخولك في netflix.com ثم ▶ من MAX.",
  };
}
