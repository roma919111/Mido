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

  if (isNativeApp && isAndroid) {
    return {
      canPlayInBrowser: false,
      isEmbeddedBrowser: embedded,
      isAndroid,
      isIOS,
      isNativeApp: true,
      warning: null,
      recommendation: "سيُفتح تطبيق المنصة الرسمي مباشرة — تأكد أنك مسجّل دخول فيه.",
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
        ? "افتح Stream Hub في Chrome على الموبايل، أو ثبّت APK — سيُفتح تطبيق Netflix/شاهد."
        : "افتح الرابط في Chrome أو Safari على جهازك الحقيقي — لا تستخدم متصفح Cursor.",
    };
  }

  if (isAndroid) {
    return {
      canPlayInBrowser: false,
      isEmbeddedBrowser: false,
      isAndroid: true,
      isIOS: false,
      isNativeApp: false,
      warning:
        "المتصفح على أندرويد غالباً يعرض «رفض التشغيل» — Netflix يشغّل من التطبيق فقط.",
      recommendation: "اضغط «فتح في التطبيق» — أو ثبّت APK ليفتح Netflix/شاهد مباشرة.",
    };
  }

  if (isIOS) {
    return {
      canPlayInBrowser: false,
      isEmbeddedBrowser: false,
      isAndroid: false,
      isIOS: true,
      isNativeApp: false,
      warning: "على iPhone/iPad التشغيل من تطبيق Netflix/شاهد أفضل من Safari.",
      recommendation: "ثبّت تطبيق المنصة وافتح الرابط من Stream Hub — سيُوجّهك للتطبيق.",
    };
  }

  return {
    canPlayInBrowser: true,
    isEmbeddedBrowser: false,
    isAndroid,
    isIOS,
    isNativeApp: false,
    warning: null,
    recommendation: "استخدم Chrome على اللابتوب — تأكد أنك مسجّل دخول في netflix.com.",
  };
}
