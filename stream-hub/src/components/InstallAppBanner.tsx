import { useEffect, useState } from "react";
import {
  dismissInstallBanner,
  isAndroidDevice,
  isBrowserTab,
  isChromeBrowser,
  isInstallBannerDismissed,
  isIosDevice,
  isSafariBrowser,
} from "../lib/display-mode";

type InstallAppBannerProps = {
  onInstall?: () => void;
};

export function InstallAppBanner({ onInstall }: InstallAppBannerProps) {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!isBrowserTab() || isInstallBannerDismissed()) return;
    setVisible(true);

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    dismissInstallBanner();
    setVisible(false);
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismissInstallBanner();
      setVisible(false);
      onInstall?.();
      return;
    }

    setShowHelp((v) => !v);
  }

  const androidChrome = isAndroidDevice() && isChromeBrowser();
  const installHelp = androidChrome
    ? "Chrome: ⋮ → «تثبيت التطبيق» أو «Add to Home screen» — بدون APK وبدون Play Protect"
    : isIosDevice()
      ? "شارك ⬆ → «Add to Home Screen»"
      : isSafariBrowser()
        ? "Safari: Share → Add to Dock"
        : "من قائمة المتصفح: Install app / Add to Home screen";

  const installNote = isAndroidDevice()
    ? "لا تحتاج APK — التثبيت من Chrome آمن ولا يتطلب «مصادر غير معروفة»."
    : "بعد التثبيت: Netflix في تبويب منفصل وMAX يبقى — ارجع لتبويب MAX للواجهة الرئيسية.";

  return (
    <div className="install-banner" role="region" aria-label="تثبيت التطبيق">
      <div className="install-banner__content">
        <p className="install-banner__title">📺 ثبّت MAX بدون APK</p>
        <p className="install-banner__text">
          ثبّت <strong>MAX MEDIA PLAYER</strong> على الشاشة الرئيسية — يختفي شريط المتصفح.{" "}
          {installNote}
        </p>
        {showHelp ? <p className="install-banner__help">{installHelp}</p> : null}
        <div className="install-banner__actions">
          <button type="button" className="install-banner__primary" onClick={() => void handleInstallClick()}>
            {deferredPrompt ? "⬇ تثبيت الآن" : "📲 كيف أثبّت؟"}
          </button>
          <button type="button" className="install-banner__ghost" onClick={handleDismiss}>
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
