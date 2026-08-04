import { useEffect, useState } from "react";
import {
  dismissInstallBanner,
  isBrowserTab,
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
  const [showSafariHelp, setShowSafariHelp] = useState(false);

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

    if (isSafariBrowser() || isIosDevice()) {
      setShowSafariHelp((v) => !v);
      return;
    }

    setShowSafariHelp(true);
  }

  const safariSteps = isIosDevice()
    ? "شارك ⬆ → «Add to Home Screen»"
    : "Safari: File → Add to Dock  ·  أو Share → Add to Dock";

  return (
    <div className="install-banner" role="region" aria-label="تثبيت التطبيق">
      <div className="install-banner__content">
        <p className="install-banner__title">📺 بدون شريط المتصفح</p>
        <p className="install-banner__text">
          ثبّت <strong>MAX MEDIA PLAYER</strong> من Dock — يختفي شريط Safari. Netflix يُفتح في تبويب
          منفصل وMAX يبقى هنا بدون إعادة تحميل.
        </p>
        {showSafariHelp ? (
          <p className="install-banner__help">{safariSteps}</p>
        ) : null}
        <div className="install-banner__actions">
          <button type="button" className="install-banner__primary" onClick={() => void handleInstallClick()}>
            ⬇ تثبيت التطبيق
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
